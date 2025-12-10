
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';
import { supabase } from '../../supabaseClient.js';
import { checkSoftenerRules, buildSummaryPrompt } from './softenerRules.js';

const GOOGLE_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;


/**
 * Módulo de Asistente IA para Reportes
 */
export class AIAssistant {
    constructor(config = {}) {
        this.context = config.context || {}; // { cliente: '...', equipo: '...' }
        this.formId = config.formId;
        this.container = null;
        this.messages = [];
        this.isProcessing = false;
        this.memoryContext = []; // Reglas aprendidas cargadas
        this.debounceTimer = null;
        this.shownAlerts = new Set(); // Para no repetir alertas
        this.lastFormData = null;
    }

    async initialize() {
        if (!GOOGLE_API_KEY) {
            console.warn('AI Assistant: No API Key found. Disabled.');
            return;
        }
        this.createUI();
        await this.loadMemory();
        this.addWelcomeMessage();
    }

    createUI() {
        // Crear contenedor flotante
        const div = document.createElement('div');
        div.id = 'ai-assistant-widget';
        div.className = 'fixed bottom-6 left-6 z-50 flex flex-col items-start pointer-events-none';

        div.innerHTML = `
            <!-- Chat Panel (Hidden by default) -->
            <div id="ai-chat-panel" class="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl w-80 mb-4 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 origin-bottom-right scale-0 opacity-0 pointer-events-auto overflow-hidden flex flex-col h-96">
                <!-- Header -->
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        <span class="font-semibold">Asistente OBM</span>
                    </div>
                    <button id="ai-close-chat" class="hover:bg-white/20 rounded p-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
                
                <!-- Messages Area -->
                <div id="ai-messages-area" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                    <!-- Messages will appear here -->
                </div>

                <!-- Input Area (Visual only for now, or for corrections) -->
                <div class="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <div class="relative">
                        <input type="text" id="ai-user-input" placeholder="Escribe para corregir o preguntar..." class="w-full pl-3 pr-10 py-2 rounded-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <button id="ai-send-btn" class="absolute right-2 top-1.5 p-1 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Toggle Button -->
            <button id="ai-toggle-btn" class="pointer-events-auto group relative flex items-center justify-center w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 focus:outline-none ring-4 ring-blue-500/20">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                
                <!-- Notification Badge -->
                <span id="ai-notification-badge" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center transform scale-0 transition-transform">0</span>
            </button>
        `;

        document.body.appendChild(div);

        // Event Listeners
        this.container = div;
        const toggleBtn = div.querySelector('#ai-toggle-btn');
        const closeBtn = div.querySelector('#ai-close-chat');
        const sendBtn = div.querySelector('#ai-send-btn');
        const input = div.querySelector('#ai-user-input');

        toggleBtn.addEventListener('click', () => this.toggleChat());
        closeBtn.addEventListener('click', () => this.toggleChat(false));

        const handleSend = () => {
            const text = input.value.trim();
            if (text) {
                this.handleUserInteraction(text);
                input.value = '';
            }
        };

        sendBtn.addEventListener('click', handleSend);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    toggleChat(forceOpen = null) {
        const panel = this.container.querySelector('#ai-chat-panel');
        const isOpen = !panel.classList.contains('scale-0');
        const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

        if (shouldOpen) {
            panel.classList.remove('scale-0', 'opacity-0');
            this.clearNotifications();
        } else {
            panel.classList.add('scale-0', 'opacity-0');
        }
    }

    addMessage(text, type = 'ai') {
        const area = this.container.querySelector('#ai-messages-area');
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex ${type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`;

        const bubbleColor = type === 'user'
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-600 rounded-bl-none shadow-sm';

        msgDiv.innerHTML = `
            <div class="${bubbleColor} max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed">
                ${marked.parse(text)} <!-- Asumimos que marked está disponible o lo usamos simple -->
            </div>
        `;

        area.appendChild(msgDiv);
        area.scrollTop = area.scrollHeight;

        if (type === 'ai' && this.container.querySelector('#ai-chat-panel').classList.contains('scale-0')) {
            this.showNotification();
        }
    }

    addWelcomeMessage() {
        const memoryCount = this.memoryContext.length;
        let msg = "Hola, soy tu asistente OBM.";
        if (memoryCount > 0) {
            msg += ` He cargado ${memoryCount} reglas específicas para este cliente/equipo.`;
        }
        msg += " Estoy monitoreando el reporte para ayudarte.";
        this.addMessage(msg, 'ai');
    }

    showNotification() {
        const badge = this.container.querySelector('#ai-notification-badge');
        badge.textContent = '1'; // Simplificado
        badge.classList.remove('scale-0');
        this.container.querySelector('#ai-toggle-btn').classList.add('animate-bounce');
        setTimeout(() => this.container.querySelector('#ai-toggle-btn').classList.remove('animate-bounce'), 2000);
    }

    clearNotifications() {
        const badge = this.container.querySelector('#ai-notification-badge');
        badge.classList.add('scale-0');
    }

    /**
     * Carga memoria desde Supabase basada en el contexto actual
     */
    async loadMemory() {
        if (!this.context.cliente && !this.context.equipo) return;

        try {
            // Construir tags de búsqueda
            const tags = ['general'];
            if (this.context.cliente) tags.push(`client:${this.context.cliente}`);
            if (this.context.equipo) tags.push(`equipment:${this.context.equipo}`);
            if (this.context.modelo) tags.push(`model:${this.context.modelo}`);

            const { data, error } = await supabase
                .from('ai_learning_base')
                .select('knowledge_snippet')
                .in('context_tag', tags);

            if (!error && data) {
                this.memoryContext = data.map(row => row.knowledge_snippet);
                console.log('AI Memory Loaded:', this.memoryContext);
            }
        } catch (e) {
            console.error('Error loading AI memory:', e);
        }
    }

    /**
     * Guarda un nuevo aprendizaje
     */
    async learn(snippet, tag = 'general') {
        const { error } = await supabase.from('ai_learning_base').insert({
            context_tag: tag,
            knowledge_snippet: snippet,
            source: 'user_interaction'
        });
        if (!error) {
            this.memoryContext.push(snippet);
            this.addMessage(`<i>He aprendido esto para la próxima: "${snippet}"</i>`, 'ai');
        }
    }

    /**
     * Llamado cuando el formulario cambia. Valida reglas locales.
     */
    observe(formData) {
        if (!formData) return;

        this.lastFormData = formData;

        // Ejecutar reglas de negocio LOCALES (sin API)
        const alerts = checkSoftenerRules(formData);

        // Mostrar nuevas alertas (evitar repetir las mismas)
        for (const alert of alerts) {
            const alertKey = `${alert.type}:${alert.field}:${alert.message.substring(0, 30)}`;

            if (!this.shownAlerts.has(alertKey)) {
                this.shownAlerts.add(alertKey);
                this.showAlert(alert);
            }
        }
    }

    /**
     * Muestra una alerta en el chat
     */
    showAlert(alert) {
        const icons = {
            'error': '🚨',
            'warning': '⚠️',
            'tip': '💡'
        };
        const icon = icons[alert.type] || '📢';
        const message = `${icon} **${alert.type === 'error' ? 'Error' : alert.type === 'warning' ? 'Atención' : 'Tip'}**: ${alert.message}`;

        this.addMessage(message, 'ai');
        this.showNotification();
    }

    /**
     * Genera resumen automático usando IA
     */
    async generateSummary() {
        if (!this.lastFormData) {
            this.addMessage('No hay datos del formulario para generar el resumen.', 'ai');
            return null;
        }

        this.isProcessing = true;
        const thinkingId = 'thinking-' + Date.now();
        this.addMessage('<span id="' + thinkingId + '" class="animate-pulse">Generando resumen...</span>', 'ai');

        const prompt = buildSummaryPrompt(this.lastFormData, this.memoryContext);
        const response = await this.callGemini(prompt);

        // Remover mensaje de thinking
        const thinkingEl = document.getElementById(thinkingId);
        if (thinkingEl) thinkingEl.parentElement.remove();

        if (response && !response.startsWith('Error')) {
            this.addMessage('**Resumen generado:**\n' + response, 'ai');
            return response;
        } else {
            this.addMessage('No pude generar el resumen: ' + response, 'ai');
            return null;
        }

        this.isProcessing = false;
    }

    /**
     * Limpia las alertas mostradas (para nuevo reporte)
     */
    resetAlerts() {
        this.shownAlerts.clear();
    }

    async analyze(formData) {
        this.isProcessing = true;
        // Feedback visual de "pensando"
        const thinkingId = 'thinking-' + Date.now();
        this.addMessage('<span id="' + thinkingId + '" class="animate-pulse">Analizando reporte...</span>', 'ai');

        const prompt = this.buildPrompt(formData);
        const response = await this.callGemini(prompt);

        // Remover mensaje de thinking
        const thinkingEl = document.getElementById(thinkingId);
        if (thinkingEl) thinkingEl.parentElement.remove(); // Hacky removal

        if (response) {
            this.addMessage(response, 'ai');
        }
        this.isProcessing = false;
    }

    async callGemini(prompt) {
        try {
            const body = {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            };

            if (!GOOGLE_API_KEY) {
                console.error('AI: No API Key found. Check VITE_GEMINI_API_KEY in .env');
                return "Error: No hay API Key configurada. Revisá el archivo .env";
            }

            console.log('AI: Calling Gemini with key starting with:', GOOGLE_API_KEY.substring(0, 10) + '...');

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                console.error('Gemini API Error:', res.status, data);
                return `Error de API (${res.status}): ${data.error?.message || 'Desconocido'}`;
            }

            if (!data.candidates || !data.candidates[0]) {
                console.warn('Gemini returned no candidates:', data);
                return "La IA no pudo generar una respuesta.";
            }

            return data.candidates[0].content.parts[0].text;
        } catch (e) {
            console.error('Gemini Error:', e);
            return "Tuve un error contactando a mi cerebro en la nube: " + e.message;
        }
    }

    buildPrompt(formData) {
        // Construir contexto con datos y memoria
        let memoryText = "";
        if (this.memoryContext.length > 0) {
            memoryText = "TEN EN CUENTA LAS SIGUIENTES REGLAS APRENDIDAS PREVIAMENTE:\n" +
                this.memoryContext.map(m => `- ${m}`).join('\n') + "\n\n";
        }

        return `
            Actúa como un supervisor experto de mantenimiento de tratamiento de aguas.
            Estás revisando un reporte técnico en tiempo real.
            
            ${memoryText}
            
            DATOS DEL REPORTE ACTUAL:
            ${JSON.stringify(formData, null, 2)}
            
            TAREA:
            1. Detecta inconsistencias graves (ej: dureza alta con autonomía baja).
            2. Detecta campos faltantes críticos (ej: autonomías vacías).
            3. Si todo parece bien, responde brevemente con un tip útil o aprobación.
            4. Se conciso, amable y profesional.
            5. Si detectas que se usó un filtro incorrecto según la memoria, avísalo.
        `;
    }

    async handleUserInteraction(text) {
        this.addMessage(text, 'user');

        // Detectar intención de "aprender"
        if (text.toLowerCase().startsWith('aprende:') || text.toLowerCase().startsWith('recuerda:')) {
            const rule = text.replace(/^(aprende|recuerda):/i, '').trim();
            // Determinar tag (default al cliente actual si existe)
            const tag = this.context.cliente ? `client:${this.context.cliente}` : 'general';
            await this.learn(rule, tag);
            return;
        }

        // Chat normal
        const prompt = `
            El técnico me dice: "${text}".
            Contexto del reporte: ${JSON.stringify(this.context)}
            Knowledge Base: ${JSON.stringify(this.memoryContext)}
            
            Respondele como un asistente técnico senior.
        `;

        const response = await this.callGemini(prompt);
        this.addMessage(response, 'ai');
    }
}

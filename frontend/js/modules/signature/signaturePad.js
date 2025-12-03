/**
 * Módulo de captura de firma digital
 * Implementa un canvas táctil para capturar firmas en dispositivos móviles y desktop
 */

export class SignaturePad {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.isEmpty = true;
        
        // Opciones por defecto
        this.options = {
            lineWidth: options.lineWidth || 2,
            strokeStyle: options.strokeStyle || '#1a365d',
            backgroundColor: options.backgroundColor || '#ffffff',
            ...options
        };
        
        this.init();
    }
    
    init() {
        // Configurar el canvas
        this.resizeCanvas();
        this.clear();
        
        // Event listeners para mouse
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        
        // Event listeners para touch (móviles)
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
        
        // Resize listener
        window.addEventListener('resize', () => {
            const data = this.toDataURL();
            this.resizeCanvas();
            if (!this.isEmpty) {
                this.fromDataURL(data);
            }
        });
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Guardar dimensiones CSS (mínimo 300x150 si no son visibles)
        const cssWidth = rect.width > 0 ? rect.width : 300;
        const cssHeight = rect.height > 0 ? rect.height : 150;
        
        // Escalar el canvas para alta resolución
        this.canvas.width = cssWidth * dpr;
        this.canvas.height = cssHeight * dpr;
        
        // Resetear y escalar el contexto
        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(dpr, dpr);
        
        // Restaurar estilos
        this.ctx.lineWidth = this.options.lineWidth;
        this.ctx.strokeStyle = this.options.strokeStyle;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }
    
    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        this.isEmpty = false;
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        e.preventDefault();
        const coords = this.getCoordinates(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
        
        this.lastX = coords.x;
        this.lastY = coords.y;
    }
    
    stopDrawing() {
        this.isDrawing = false;
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.startDrawing(mouseEvent);
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (!this.isDrawing) return;
        
        const coords = this.getCoordinates(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
        
        this.lastX = coords.x;
        this.lastY = coords.y;
    }
    
    clear() {
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.isEmpty = true;
    }
    
    isCanvasEmpty() {
        return this.isEmpty;
    }
    
    toDataURL(type = 'image/png', quality = 0.92) {
        return this.canvas.toDataURL(type, quality);
    }
    
    fromDataURL(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.ctx.drawImage(img, 0, 0, this.canvas.width / (window.devicePixelRatio || 1), this.canvas.height / (window.devicePixelRatio || 1));
            this.isEmpty = false;
        };
        img.src = dataUrl;
    }
    
    destroy() {
        this.canvas.removeEventListener('mousedown', this.startDrawing);
        this.canvas.removeEventListener('mousemove', this.draw);
        this.canvas.removeEventListener('mouseup', this.stopDrawing);
        this.canvas.removeEventListener('mouseout', this.stopDrawing);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.stopDrawing);
    }
}

/**
 * Componente de modal de firmas
 */
export class SignatureModal {
    constructor(options = {}) {
        this.options = {
            onComplete: options.onComplete || (() => {}),
            onCancel: options.onCancel || (() => {}),
            technicianName: options.technicianName || 'Técnico',
            ...options
        };
        
        this.technicianPad = null;
        this.clientPad = null;
        this.modal = null;
        this.currentStep = 1;
        
        this.createModal();
    }
    
    createModal() {
        // Crear el HTML del modal
        const modalHtml = `
            <div id="signature-modal" class="signature-modal hidden">
                <div class="signature-modal-backdrop"></div>
                <div class="signature-modal-content">
                    <div class="signature-modal-header">
                        <h3 id="signature-modal-title">Firma del Técnico</h3>
                        <button type="button" id="signature-modal-close" class="signature-modal-close">&times;</button>
                    </div>
                    
                    <div class="signature-modal-body">
                        <!-- Indicador de pasos -->
                        <div class="signature-steps">
                            <div class="signature-step active" data-step="1">
                                <span class="step-number">1</span>
                                <span class="step-label">Técnico</span>
                            </div>
                            <div class="signature-step-connector"></div>
                            <div class="signature-step" data-step="2">
                                <span class="step-number">2</span>
                                <span class="step-label">Cliente</span>
                            </div>
                        </div>
                        
                        <!-- Paso 1: Firma técnico -->
                        <div id="signature-step-1" class="signature-step-content">
                            <p class="signature-instruction">Por favor, firme como técnico responsable del servicio:</p>
                            <div class="signature-canvas-container">
                                <canvas id="technician-signature-canvas"></canvas>
                            </div>
                            <div class="signature-name-input">
                                <label for="technician-name">Aclaración:</label>
                                <input type="text" id="technician-name" placeholder="Nombre completo del técnico">
                            </div>
                        </div>
                        
                        <!-- Paso 2: Firma cliente -->
                        <div id="signature-step-2" class="signature-step-content hidden">
                            <p class="signature-instruction">Por favor, firme como conformidad del cliente:</p>
                            <div class="signature-canvas-container">
                                <canvas id="client-signature-canvas"></canvas>
                            </div>
                            <div class="signature-name-input">
                                <label for="client-name">Aclaración:</label>
                                <input type="text" id="client-name" placeholder="Nombre completo del cliente">
                            </div>
                        </div>
                    </div>
                    
                    <div class="signature-modal-footer">
                        <button type="button" id="signature-clear-btn" class="signature-btn signature-btn-secondary">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Limpiar
                        </button>
                        <button type="button" id="signature-back-btn" class="signature-btn signature-btn-secondary hidden">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Anterior
                        </button>
                        <button type="button" id="signature-next-btn" class="signature-btn signature-btn-primary">
                            Siguiente
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button type="button" id="signature-complete-btn" class="signature-btn signature-btn-success hidden">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Confirmar Firmas
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Insertar en el DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('signature-modal');
        
        // Inicializar event listeners
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Cerrar modal
        document.getElementById('signature-modal-close').addEventListener('click', () => this.close());
        document.querySelector('.signature-modal-backdrop').addEventListener('click', () => this.close());
        
        // Botones de navegación
        document.getElementById('signature-clear-btn').addEventListener('click', () => this.clearCurrentSignature());
        document.getElementById('signature-back-btn').addEventListener('click', () => this.goToStep(1));
        document.getElementById('signature-next-btn').addEventListener('click', () => this.goToStep(2));
        document.getElementById('signature-complete-btn').addEventListener('click', () => this.complete());
        
        // Prevenir scroll del body cuando el modal está abierto
        this.modal.addEventListener('touchmove', (e) => {
            if (e.target.tagName !== 'CANVAS') {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    open(technicianName = '') {
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Inicializar los pads de firma después de que el modal sea visible
        setTimeout(() => {
            const techCanvas = document.getElementById('technician-signature-canvas');
            const clientCanvas = document.getElementById('client-signature-canvas');
            
            if (!this.technicianPad) {
                this.technicianPad = new SignaturePad(techCanvas);
            }
            if (!this.clientPad) {
                this.clientPad = new SignaturePad(clientCanvas);
            }
            
            // Prellenar nombre del técnico si está disponible
            if (technicianName) {
                document.getElementById('technician-name').value = technicianName;
            }
            
            this.goToStep(1);
        }, 100);
    }
    
    close() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
        this.options.onCancel();
    }
    
    goToStep(step) {
        this.currentStep = step;
        
        // Actualizar indicadores de paso
        document.querySelectorAll('.signature-step').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.step) === step);
            el.classList.toggle('completed', parseInt(el.dataset.step) < step);
        });
        
        // Mostrar/ocultar contenido de pasos
        document.getElementById('signature-step-1').classList.toggle('hidden', step !== 1);
        document.getElementById('signature-step-2').classList.toggle('hidden', step !== 2);
        
        // Actualizar título
        document.getElementById('signature-modal-title').textContent = 
            step === 1 ? 'Firma del Técnico' : 'Firma del Cliente';
        
        // Actualizar botones
        document.getElementById('signature-back-btn').classList.toggle('hidden', step === 1);
        document.getElementById('signature-next-btn').classList.toggle('hidden', step === 2);
        document.getElementById('signature-complete-btn').classList.toggle('hidden', step === 1);
        
        // Reinicializar el canvas del paso actual después de que sea visible
        setTimeout(() => {
            if (step === 1 && this.technicianPad) {
                this.technicianPad.resizeCanvas();
                this.technicianPad.clear();
            } else if (step === 2 && this.clientPad) {
                this.clientPad.resizeCanvas();
                // Solo limpiar si está vacío (para no perder firma si vuelve atrás)
                if (this.clientPad.isEmpty) {
                    this.clientPad.clear();
                }
            }
        }, 50);
    }
    
    clearCurrentSignature() {
        if (this.currentStep === 1 && this.technicianPad) {
            this.technicianPad.clear();
        } else if (this.currentStep === 2 && this.clientPad) {
            this.clientPad.clear();
        }
    }
    
    complete() {
        // Validar que ambas firmas estén completas
        if (this.technicianPad.isCanvasEmpty()) {
            alert('Por favor, complete la firma del técnico');
            this.goToStep(1);
            return;
        }
        
        if (this.clientPad.isCanvasEmpty()) {
            alert('Por favor, complete la firma del cliente');
            return;
        }
        
        const technicianName = document.getElementById('technician-name').value.trim();
        const clientName = document.getElementById('client-name').value.trim();
        
        // Obtener las firmas como base64
        const signatures = {
            technician: {
                image: this.technicianPad.toDataURL(),
                name: technicianName,
                timestamp: new Date().toISOString()
            },
            client: {
                image: this.clientPad.toDataURL(),
                name: clientName,
                timestamp: new Date().toISOString()
            }
        };
        
        // Cerrar modal y llamar callback
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
        this.options.onComplete(signatures);
    }
    
    destroy() {
        if (this.technicianPad) this.technicianPad.destroy();
        if (this.clientPad) this.clientPad.destroy();
        if (this.modal) this.modal.remove();
    }
}

// Exportar función helper para integrar fácilmente
export function createSignatureCapture(options = {}) {
    return new SignatureModal(options);
}

/**
 * Mis Tickets Module
 * Permite a los usuarios ver el estado de sus tickets de feedback
 */

const ESTADO_BADGES = {
    nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700', icon: '🔵' },
    en_revision: { label: 'En revisión', color: 'bg-yellow-100 text-yellow-700', icon: '🟡' },
    resuelto: { label: 'Resuelto', color: 'bg-green-100 text-green-700', icon: '🟢' },
    cerrado: { label: 'Cerrado', color: 'bg-gray-100 text-gray-600', icon: '⚫' },
};

const CATEGORIA_ICONS = {
    bug: '🐛',
    mejora: '💡',
    rendimiento: '⚡',
    otro: '📝',
};

export function createMisTicketsModule({ getMisFeedbackTickets }) {
    if (typeof getMisFeedbackTickets !== 'function') {
        throw new Error('createMisTicketsModule requiere getMisFeedbackTickets');
    }

    let elements = null;
    let ticketsCache = [];
    let isLoading = false;

    function cacheElements() {
        elements = {
            modal: document.getElementById('mis-tickets-modal'),
            backdrop: document.getElementById('mis-tickets-backdrop'),
            closeBtn: document.getElementById('mis-tickets-close-btn'),
            list: document.getElementById('mis-tickets-list'),
            menuItem: document.getElementById('mis-tickets-menu-item'),
        };
    }

    function ensureElements() {
        if (!elements) {
            cacheElements();
        }
        return elements;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return '-';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function truncateText(text, maxLength = 80) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    function renderTicket(ticket) {
        const estado = ESTADO_BADGES[ticket.estado] || ESTADO_BADGES.nuevo;
        const categoriaIcon = CATEGORIA_ICONS[ticket.categoria] || '📝';
        const fechaStr = formatDate(ticket.created_at);
        const hasResponse = ticket.respuesta_admin && ticket.respuesta_admin.trim();

        return `
            <div class="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div class="flex items-start gap-3">
                    <div class="text-2xl">${categoriaIcon}</div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-900 truncate">${escapeHtml(truncateText(ticket.mensaje, 60))}</p>
                        <div class="flex items-center gap-3 mt-2 flex-wrap">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estado.color}">
                                ${estado.icon} ${estado.label}
                            </span>
                            <span class="text-xs text-gray-500">Enviado: ${fechaStr}</span>
                        </div>
                        ${hasResponse ? `
                        <div class="mt-3 p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-400">
                            <p class="text-xs text-indigo-600 font-medium mb-1">💬 Respuesta del equipo:</p>
                            <p class="text-sm text-gray-700">${escapeHtml(ticket.respuesta_admin)}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderTicketsList(tickets) {
        const { list } = ensureElements();
        if (!list) return;

        if (!tickets || tickets.length === 0) {
            list.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No tenés tickets de feedback.</p>
                    <p class="text-sm mt-1">Cuando envíes un comentario o reporte, aparecerá acá.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = tickets.map(renderTicket).join('');
    }

    async function loadTickets() {
        const { list } = ensureElements();
        if (!list || isLoading) return;

        isLoading = true;
        list.innerHTML = `
            <div class="flex items-center justify-center py-8 text-gray-500">
                <svg class="animate-spin h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Cargando tickets...
            </div>
        `;

        try {
            ticketsCache = await getMisFeedbackTickets();
            renderTicketsList(ticketsCache);
        } catch (error) {
            console.error('[MisTickets] Error:', error);
            list.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <p>Error al cargar los tickets.</p>
                    <p class="text-sm">${escapeHtml(error.message)}</p>
                </div>
            `;
        } finally {
            isLoading = false;
        }
    }

    function showModal() {
        const { modal, backdrop } = ensureElements();
        if (!modal || !backdrop) return;

        modal.classList.remove('hidden');
        backdrop.classList.remove('hidden');
        document.body.classList.add('modal-open');

        loadTickets();
    }

    function hideModal() {
        const { modal, backdrop } = ensureElements();
        if (!modal || !backdrop) return;

        modal.classList.add('hidden');
        backdrop.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    function attachListeners() {
        const { closeBtn, backdrop, menuItem } = ensureElements();

        menuItem?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Cerrar menú de usuario
            const userMenu = document.getElementById('user-menu');
            userMenu?.classList.add('hidden');
            showModal();
        });

        closeBtn?.addEventListener('click', hideModal);
        backdrop?.addEventListener('click', hideModal);

        // Escape para cerrar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const { modal } = ensureElements();
                if (modal && !modal.classList.contains('hidden')) {
                    hideModal();
                }
            }
        });
    }

    function initialize() {
        cacheElements();
        attachListeners();
    }

    return {
        initialize,
        open: showModal,
        close: hideModal,
    };
}

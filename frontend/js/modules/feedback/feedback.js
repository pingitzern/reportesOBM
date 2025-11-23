const MIN_MESSAGE_LENGTH = 12;

function getElementById(id) {
    return document.getElementById(id);
}

export function createFeedbackModule({ enviarFeedbackTicket }) {
    if (typeof enviarFeedbackTicket !== 'function') {
        throw new Error('createFeedbackModule requiere enviarFeedbackTicket');
    }

    let elements = null;
    let lastFocusElement = null;
    let isSubmitting = false;

    function cacheElements() {
        elements = {
            modal: getElementById('feedback-modal'),
            backdrop: getElementById('feedback-modal-backdrop'),
            panel: getElementById('feedback-modal-panel'),
            form: getElementById('feedback-form'),
            cancelButton: getElementById('feedback-cancel-button'),
            submitButton: getElementById('feedback-submit-button'),
            errorBox: getElementById('feedback-error'),
            successBox: getElementById('feedback-success'),
            messageField: getElementById('feedback-message'),
            charCount: getElementById('feedback-char-count'),
        };
    }

    function ensureElements() {
        if (!elements) {
            cacheElements();
        }
        return elements;
    }

    function updateCharCount() {
        const { messageField, charCount } = ensureElements();
        if (!messageField || !charCount) {
            return;
        }
        const length = messageField.value.trim().length;
        charCount.textContent = `${length}/${MIN_MESSAGE_LENGTH}`;
        charCount.dataset.state = length >= MIN_MESSAGE_LENGTH ? 'ready' : 'pending';
    }

    function showModal() {
        const { modal, backdrop, messageField } = ensureElements();
        if (!modal || !backdrop) {
            return;
        }
        lastFocusElement = document.activeElement;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        backdrop.classList.remove('hidden');
        document.body.classList.add('modal-open');
        setTimeout(() => {
            if (messageField) {
                messageField.focus();
            }
        }, 50);
        document.addEventListener('keydown', handleKeyDown);
        updateCharCount();
    }

    function hideModal() {
        const { modal, backdrop } = ensureElements();
        if (!modal || !backdrop) {
            return;
        }
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        backdrop.classList.add('hidden');
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', handleKeyDown);
        if (lastFocusElement && typeof lastFocusElement.focus === 'function') {
            lastFocusElement.focus();
            lastFocusElement = null;
        }
    }

    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    }

    function serializeForm() {
        const { form } = ensureElements();
        if (!form) {
            return null;
        }
        const data = new FormData(form);
        return {
            categoria: data.get('feedback-category') || 'general',
            impacto: data.get('feedback-impact') || 'medio',
            mensaje: (data.get('feedback-message') || '').trim(),
            contacto: (data.get('feedback-contact') || '').trim(),
            permitirContacto: data.get('feedback-allow-contact') === 'on',
            origenUrl: window.location.href,
            userAgent: navigator?.userAgent || 'unknown',
        };
    }

    function validatePayload(payload) {
        if (!payload) {
            return 'No se pudo leer el formulario.';
        }
        if (!payload.mensaje || payload.mensaje.length < MIN_MESSAGE_LENGTH) {
            return `Contanos un poco más (mínimo ${MIN_MESSAGE_LENGTH} caracteres).`;
        }
        return null;
    }

    function setLoading(state) {
        const { submitButton } = ensureElements();
        isSubmitting = state;
        if (submitButton) {
            submitButton.disabled = state;
            submitButton.classList.toggle('is-loading', state);
            submitButton.textContent = state ? 'Enviando...' : 'Enviar feedback';
        }
    }

    function showError(message) {
        const { errorBox, successBox } = ensureElements();
        if (successBox) {
            successBox.classList.add('hidden');
            successBox.textContent = '';
        }
        if (errorBox) {
            errorBox.textContent = message || 'Ocurrió un error inesperado.';
            errorBox.classList.remove('hidden');
        }
    }

    function showSuccess(message) {
        const { errorBox, successBox, form } = ensureElements();
        if (errorBox) {
            errorBox.classList.add('hidden');
            errorBox.textContent = '';
        }
        if (successBox) {
            successBox.textContent = message || '¡Gracias por tu aporte!';
            successBox.classList.remove('hidden');
        }
        if (form) {
            form.reset();
        }
        updateCharCount();
        setTimeout(() => {
            close();
        }, 2400);
    }

    function handleOverlayClick(event) {
        const { modal } = ensureElements();
        if (modal && event.target === modal) {
            close();
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (isSubmitting) {
            return;
        }
        const payload = serializeForm();
        const errorMessage = validatePayload(payload);
        if (errorMessage) {
            showError(errorMessage);
            return;
        }
        try {
            setLoading(true);
            await enviarFeedbackTicket(payload);
            showSuccess('¡Gracias! Guardamos tu comentario.');
        } catch (error) {
            console.error('Error enviando feedback', error);
            showError(error?.message || 'No pudimos enviar tu feedback. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    }

    function attachEntryPoints() {
        document.querySelectorAll('[data-feedback-trigger]').forEach(trigger => {
            trigger.addEventListener('click', event => {
                event.preventDefault();
                open();
            });
        });
    }

    function attachListeners() {
        const { form, cancelButton, modal, backdrop, panel } = ensureElements();
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
        if (cancelButton) {
            cancelButton.addEventListener('click', event => {
                event.preventDefault();
                close();
            });
        }
        if (modal) {
            modal.addEventListener('click', handleOverlayClick);
        }
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                close();
            });
        }
        if (panel) {
            panel.addEventListener('click', event => {
                event.stopPropagation();
            });
        }
        const { messageField } = ensureElements();
        if (messageField) {
            messageField.addEventListener('input', updateCharCount);
        }
        attachEntryPoints();
    }

    function open() {
        showModal();
    }

    function close() {
        if (isSubmitting) {
            return;
        }
        hideModal();
    }

    function initialize() {
        cacheElements();
        attachListeners();
        updateCharCount();
    }

    return {
        initialize,
        open,
        close,
    };
}

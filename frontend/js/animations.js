/**
 * Sistema de animaciones para mejorar la experiencia visual
 */

// Observador de intersección para animar elementos al entrar en viewport
const animateOnScroll = () => {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in');
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        }
    );

    // Observar todos los form-cards
    document.querySelectorAll('.form-card').forEach((card) => {
        observer.observe(card);
    });
};

// Agregar efecto ripple a botones
const addRippleEffect = () => {
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.action-button, .tab-button');
        if (!button) return;

        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.add('ripple');

        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });

    // Agregar estilos del ripple
    if (!document.getElementById('ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = `
            .ripple {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple-animation 0.6s ease-out;
                pointer-events: none;
            }
            
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
};

// Efecto de parallax suave en el header
const addParallaxEffect = () => {
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const header = document.querySelector('header');
                if (header) {
                    const scrolled = window.pageYOffset;
                    header.style.transform = `translateY(${scrolled * 0.3}px)`;
                    header.style.opacity = Math.max(0.5, 1 - scrolled / 300);
                }
                ticking = false;
            });
            ticking = true;
        }
    });
};

// Animación de entrada para pestañas
const animateTabContent = () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (!target.classList.contains('hidden')) {
                    target.style.opacity = '0';
                    target.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
                        target.style.transition = 'all 0.4s ease-out';
                        target.style.opacity = '1';
                        target.style.transform = 'translateY(0)';
                    }, 10);
                }
            }
        });
    });

    document.querySelectorAll('.tab-content').forEach((tab) => {
        observer.observe(tab, { attributes: true });
    });
};

// Efecto de loading suave
const showLoadingState = (button, isLoading) => {
    if (isLoading) {
        button.dataset.originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
            <svg class="spinner mr-2" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/>
                <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Procesando...
        `;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
};

// Inicializar todas las animaciones
const initAnimations = () => {
    // Esperar a que el DOM esté completamente cargado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            animateOnScroll();
            addRippleEffect();
            animateTabContent();
            
            // Parallax solo en desktop
            if (window.innerWidth > 768) {
                addParallaxEffect();
            }
        });
    } else {
        animateOnScroll();
        addRippleEffect();
        animateTabContent();
        
        if (window.innerWidth > 768) {
            addParallaxEffect();
        }
    }
};

// Auto-inicializar
initAnimations();

// Exportar funciones útiles
export { showLoadingState, animateOnScroll };

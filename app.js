// ============================================
// ColorPicker Component - Componente Reutilizável
// ============================================
class ColorPicker {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            onAddColor: options.onAddColor || (() => {}),
            initialColor: options.initialColor || '#000000'
        };
        
        // Estado da cor atual (HSV)
        this.hue = 0; // 0-360
        this.saturation = 0; // 0-100
        this.value = 0; // 0-100
        
        // Elementos DOM
        this.elements = {};
        
        // Flags de interação
        this.isDraggingSV = false;
        this.isDraggingHue = false;
        
        // Throttle para atualizações
        this.updateThrottle = null;
        
        // Estado de foco para desenhar halo magenta
        this.isFocusedSV = false;
        this.isFocusedHue = false;
        
        // Inicializar
        this.init();
    }
    
    // ============================================
    // Carregar Imagem de Handle
    // ============================================
    loadPawImage() {
        this.pawImage = new Image();
        this.pawImage.onload = () => {
            this.pawImageLoaded = true;
            this.draw();
        };
        this.pawImage.onerror = () => {
            this.pawImageLoaded = false;
            console.warn('Não foi possível carregar a imagem do handle. Usando fallback.');
        };
        this.pawImage.src = 'handle/handle.svg';
    }
    
    init() {
        this.createHTML();
        this.setupEventListeners();
        this.setColor(this.options.initialColor);
    }
    
    createHTML() {
        const pickerId = `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        this.container.innerHTML = `
            <section class="color-picker" data-picker-id="${pickerId}">
                <div class="cp-header">
                    <div class="cp-hex-group">
                        <label class="cp-hex-label">
                            <span>HEX</span>
                            <input 
                                type="text" 
                                class="cp-hex-input" 
                                placeholder="#RRGGBB" 
                                maxlength="7" 
                                inputmode="text" 
                                aria-label="Código hexadecimal da cor"
                                aria-describedby="cp-hex-error-${pickerId}"
                            >
                            <div id="cp-hex-error-${pickerId}" class="cp-hex-error" aria-live="polite" role="alert"></div>
                        </label>
                        <button type="button" class="cp-add-btn">＋ Adicionar</button>
                    </div>
                </div>
                <div class="cp-workspace">
                    <canvas 
                        class="cp-sv" 
                        width="280" 
                        height="140" 
                        aria-label="Seleção de Saturação e Valor" 
                        role="slider"
                        tabindex="0"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="0"
                    ></canvas>
                    <canvas 
                        class="cp-hue" 
                        width="280" 
                        height="18" 
                        aria-label="Seleção de Matiz (HUE)" 
                        role="slider"
                        tabindex="0"
                        aria-valuemin="0"
                        aria-valuemax="360"
                        aria-valuenow="0"
                    ></canvas>
                </div>
            </section>
        `;
        
        // Armazenar referências dos elementos
        this.elements = {
            hexInput: this.container.querySelector('.cp-hex-input'),
            hexError: this.container.querySelector('.cp-hex-error'),
            addBtn: this.container.querySelector('.cp-add-btn'),
            svCanvas: this.container.querySelector('.cp-sv'),
            hueCanvas: this.container.querySelector('.cp-hue')
        };
        
        // Imagem de pata (memoizada)
        this.pawImage = null;
        this.pawImageLoaded = false;
        this.loadPawImage();
        
        // Configurar dimensões dos canvas
        this.setupCanvas();
    }
    
    setupCanvas() {
        const svCanvas = this.elements.svCanvas;
        const hueCanvas = this.elements.hueCanvas;
        
        // Ajustar tamanho do canvas SV (240-300px)
        const svSize = Math.min(280, window.innerWidth < 768 ? 240 : 280);
        svCanvas.width = svSize;
        svCanvas.height = Math.floor(svSize * 0.5); // Altura = metade da largura
        
        // Ajustar tamanho do canvas HUE
        hueCanvas.width = svSize;
        hueCanvas.height = 18;
        
        // Redesenhar
        this.draw();
    }
    
    setupEventListeners() {
        // Input HEX
        this.elements.hexInput.addEventListener('input', (e) => {
            this.handleHexInput(e.target.value);
            // Tentar validar e sincronizar se o valor estiver completo
            const value = e.target.value.trim();
            if (value.length === 7) {
                this.validateAndSyncHex();
            }
        });
        
        this.elements.hexInput.addEventListener('blur', () => {
            this.validateAndSyncHex();
        });
        
        // Botão adicionar
        this.elements.addBtn.addEventListener('click', () => {
            this.addCurrentColor();
        });
        
        // Canvas SV - Mouse
        this.elements.svCanvas.addEventListener('mousedown', (e) => {
            this.startDragSV(e);
        });
        
        this.elements.svCanvas.addEventListener('mousemove', (e) => {
            if (this.isDraggingSV) {
                this.updateFromSV(e);
            }
        });
        
        this.elements.svCanvas.addEventListener('mouseup', () => {
            this.stopDragSV();
        });
        
        this.elements.svCanvas.addEventListener('mouseleave', () => {
            this.stopDragSV();
        });
        
        // Canvas SV - Touch
        this.elements.svCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDragSV({ clientX: touch.clientX, clientY: touch.clientY, touches: [touch] });
        }, { passive: false });
        
        this.elements.svCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isDraggingSV) {
                const touch = e.touches[0];
                this.updateFromSV({ clientX: touch.clientX, clientY: touch.clientY, touches: [touch] });
            }
        }, { passive: false });
        
        this.elements.svCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDragSV();
        }, { passive: false });
        
        // Canvas SV - Teclado
        this.elements.svCanvas.addEventListener('keydown', (e) => {
            this.handleSVKeyboard(e);
        });
        
        // Canvas SV - Foco
        this.elements.svCanvas.addEventListener('focus', () => {
            this.isFocusedSV = true;
            this.draw();
        });
        
        this.elements.svCanvas.addEventListener('blur', () => {
            this.isFocusedSV = false;
            this.draw();
        });
        
        // Canvas HUE - Mouse
        this.elements.hueCanvas.addEventListener('mousedown', (e) => {
            this.startDragHue(e);
        });
        
        this.elements.hueCanvas.addEventListener('mousemove', (e) => {
            if (this.isDraggingHue) {
                this.updateFromHue(e);
            }
        });
        
        this.elements.hueCanvas.addEventListener('mouseup', () => {
            this.stopDragHue();
        });
        
        this.elements.hueCanvas.addEventListener('mouseleave', () => {
            this.stopDragHue();
        });
        
        // Canvas HUE - Touch
        this.elements.hueCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDragHue({ clientX: touch.clientX, touches: [touch] });
        }, { passive: false });
        
        this.elements.hueCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isDraggingHue) {
                const touch = e.touches[0];
                this.updateFromHue({ clientX: touch.clientX, touches: [touch] });
            }
        }, { passive: false });
        
        this.elements.hueCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDragHue();
        }, { passive: false });
        
        // Canvas HUE - Teclado
        this.elements.hueCanvas.addEventListener('keydown', (e) => {
            this.handleHueKeyboard(e);
        });
        
        // Canvas HUE - Foco
        this.elements.hueCanvas.addEventListener('focus', () => {
            this.isFocusedHue = true;
            this.draw();
        });
        
        this.elements.hueCanvas.addEventListener('blur', () => {
            this.isFocusedHue = false;
            this.draw();
        });
        
        // Redimensionar canvas quando a janela mudar de tamanho
        window.addEventListener('resize', () => {
            this.setupCanvas();
        });
    }
    
    // ============================================
    // Conversões de Cor
    // ============================================
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    
    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
        }
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        
        const s = max === 0 ? 0 : Math.round((delta / max) * 100);
        const v = Math.round(max * 100);
        
        return { h, s, v };
    }
    
    hsvToRgb(h, s, v) {
        h = h / 360;
        s = s / 100;
        v = v / 100;
        
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        
        let r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
    
    hsvToHex(h, s, v) {
        const rgb = this.hsvToRgb(h, s, v);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    }
    
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
        }
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        
        const l = (max + min) / 2;
        const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        
        return {
            h,
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }
    
    // ============================================
    // Atualização de Cor
    // ============================================
    setColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return;
        
        const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
        this.hue = hsv.h;
        this.saturation = hsv.s;
        this.value = hsv.v;
        
        this.updateUI();
    }
    
    updateUI() {
        // Atualizar input HEX
        const hex = this.hsvToHex(this.hue, this.saturation, this.value);
        this.elements.hexInput.value = hex.toUpperCase();
        this.elements.hexInput.classList.remove('invalid');
        this.elements.hexError.textContent = '';
        
        // Atualizar ARIA
        this.elements.svCanvas.setAttribute('aria-valuenow', Math.round((this.saturation + this.value) / 2));
        this.elements.hueCanvas.setAttribute('aria-valuenow', this.hue);
        
        // Redesenhar canvas
        this.draw();
    }
    
    // ============================================
    // Desenho dos Canvas
    // ============================================
    draw() {
        this.drawSV();
        this.drawHue();
    }
    
    drawSV() {
        const canvas = this.elements.svCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Limpar canvas
        ctx.clearRect(0, 0, width, height);
        
        // Criar gradiente baseado no HUE atual
        const baseColor = this.hsvToRgb(this.hue, 100, 100);
        const baseHex = this.rgbToHex(baseColor.r, baseColor.g, baseColor.b);
        
        // Gradiente horizontal (Saturação)
        const satGradient = ctx.createLinearGradient(0, 0, width, 0);
        satGradient.addColorStop(0, '#ffffff');
        satGradient.addColorStop(1, baseHex);
        
        ctx.fillStyle = satGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Gradiente vertical (Valor/Brilho)
        const valGradient = ctx.createLinearGradient(0, 0, 0, height);
        valGradient.addColorStop(0, 'transparent');
        valGradient.addColorStop(1, '#000000');
        
        ctx.fillStyle = valGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Desenhar handle (marcador)
        const x = (this.saturation / 100) * width;
        const y = (1 - this.value / 100) * height;
        this.drawHandle(ctx, x, y);
    }
    
    drawHue() {
        const canvas = this.elements.hueCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Limpar canvas
        ctx.clearRect(0, 0, width, height);
        
        // Criar gradiente de HUE (0-360°)
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        for (let i = 0; i <= 360; i += 60) {
            const rgb = this.hsvToRgb(i, 100, 100);
            const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
            gradient.addColorStop(i / 360, hex);
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Desenhar handle (thumb)
        const x = (this.hue / 360) * width;
        this.drawHueHandle(ctx, x, height);
    }
    
    drawHandle(ctx, x, y) {
        ctx.save();
        
        const size = 22; // Tamanho da pata (~20-24px)
        const halfSize = size / 2;
        
        // Desenhar halo magenta quando focado
        if (this.isFocusedSV) {
            const magentaColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border-focus').trim() || '#d946ef';
            ctx.strokeStyle = magentaColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Desenhar pata se a imagem estiver carregada
        if (this.pawImageLoaded && this.pawImage) {
            ctx.drawImage(this.pawImage, x - halfSize, y - halfSize, size, size);
        } else {
            // Fallback: círculo simples enquanto carrega
            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawHueHandle(ctx, x, height) {
        ctx.save();
        
        const size = 22; // Tamanho da pata (~20-24px)
        const halfSize = size / 2;
        const y = height / 2;
        
        // Desenhar halo magenta quando focado
        if (this.isFocusedHue) {
            const magentaColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border-focus').trim() || '#d946ef';
            ctx.strokeStyle = magentaColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Desenhar pata se a imagem estiver carregada
        if (this.pawImageLoaded && this.pawImage) {
            ctx.drawImage(this.pawImage, x - halfSize, y - halfSize, size, size);
        } else {
            // Fallback: retângulo simples enquanto carrega
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 1;
            
            ctx.beginPath();
            ctx.rect(x - 4, 0, 8, height);
            ctx.stroke();
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(x - 3, 1, 6, height - 2);
        }
        
        ctx.restore();
    }
    
    // ============================================
    // Interações - SV Canvas
    // ============================================
    startDragSV(e) {
        this.isDraggingSV = true;
        this.updateFromSV(e);
    }
    
    stopDragSV() {
        this.isDraggingSV = false;
    }
    
    updateFromSV(e) {
        if (!this.isDraggingSV && e.type !== 'mousedown' && !e.touches) return;
        
        const canvas = this.elements.svCanvas;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : e.touches ? e.touches[0].clientX : 0;
        const clientY = e.clientY !== undefined ? e.clientY : e.touches ? e.touches[0].clientY : 0;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const saturation = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const value = Math.max(0, Math.min(100, (1 - y / rect.height) * 100));
        
        this.saturation = Math.round(saturation);
        this.value = Math.round(value);
        
        this.throttledUpdate();
    }
    
    handleSVKeyboard(e) {
        const step = e.shiftKey ? 10 : 1;
        let changed = false;
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.saturation = Math.max(0, this.saturation - step);
                changed = true;
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.saturation = Math.min(100, this.saturation + step);
                changed = true;
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.value = Math.min(100, this.value + step);
                changed = true;
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.value = Math.max(0, this.value - step);
                changed = true;
                break;
        }
        
        if (changed) {
            this.updateUI();
        }
    }
    
    // ============================================
    // Interações - HUE Canvas
    // ============================================
    startDragHue(e) {
        this.isDraggingHue = true;
        this.updateFromHue(e);
    }
    
    stopDragHue() {
        this.isDraggingHue = false;
    }
    
    updateFromHue(e) {
        if (!this.isDraggingHue && e.type !== 'mousedown' && !e.touches) return;
        
        const canvas = this.elements.hueCanvas;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : e.touches ? e.touches[0].clientX : 0;
        const x = clientX - rect.left;
        
        const hue = Math.max(0, Math.min(360, (x / rect.width) * 360));
        this.hue = Math.round(hue);
        
        this.throttledUpdate();
    }
    
    handleHueKeyboard(e) {
        const step = e.shiftKey ? 10 : 1;
        let changed = false;
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.hue = Math.max(0, this.hue - step);
                changed = true;
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.hue = Math.min(360, this.hue + step);
                changed = true;
                break;
        }
        
        if (changed) {
            this.updateUI();
        }
    }
    
    // ============================================
    // Input HEX
    // ============================================
    handleHexInput(value) {
        // Aplicar máscara: apenas # e hexadecimais
        let masked = value.replace(/[^#0-9a-fA-F]/g, '');
        if (masked.length > 0 && masked[0] !== '#') {
            masked = '#' + masked.replace(/#/g, '');
        }
        if (masked.length > 7) {
            masked = masked.substring(0, 7);
        }
        
        this.elements.hexInput.value = masked;
    }
    
    validateAndSyncHex() {
        const value = this.elements.hexInput.value.trim();
        const hexPattern = /^#(?:[0-9a-fA-F]{6})$/;
        
        if (!hexPattern.test(value)) {
            this.elements.hexInput.classList.add('invalid');
            this.elements.hexError.textContent = 'HEX inválido';
            return false;
        }
        
        // Sincronizar com picker
        this.setColor(value);
        return true;
    }
    
    // ============================================
    // Ações
    // ============================================
    addCurrentColor() {
        const hex = this.hsvToHex(this.hue, this.saturation, this.value).toUpperCase();
        const success = this.options.onAddColor(hex);
        
        if (!success) {
            // Feedback de erro (cor já existe)
            this.elements.hexInput.classList.add('invalid');
            this.elements.hexError.textContent = 'Cor já adicionada';
            setTimeout(() => {
                this.elements.hexInput.classList.remove('invalid');
                this.elements.hexError.textContent = '';
            }, 2000);
        }
    }
    
    // ============================================
    // Utilitários
    // ============================================
    throttledUpdate() {
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
        }
        
        this.updateThrottle = setTimeout(() => {
            this.updateUI();
        }, 16); // ~60fps
    }
}

// ============================================
// ClienteForm - Módulo de Formulário de Cliente
// ============================================
class ClienteForm {
    constructor() {
        this.contacts = []; // Contatos opcionais (sem contato padrão)
        this.nomeInput = document.getElementById('cli-nome');
        this.pronomesSelect = document.getElementById('cli-pronomes');
        this.emailInput = document.getElementById('cli-email');
        this.telefoneInput = document.getElementById('cli-telefone');
        this.contactsList = document.getElementById('contacts-list');
        this.addContactBtn = document.getElementById('add-contact');
        
        this.placeholders = {
            twitter: '@username',
            telegram: '@username',
            discord: 'username0000',
            instagram: '@username'
        };
        
        this.validations = {
            twitter: {
                regex: /^@[\w]{1,15}$/,
                message: 'Twitter must start with @ and have 1-15 characters (letters, numbers or _)'
            },
            telegram: {
                regex: /^@[A-Za-z0-9_]{5,32}$/,
                message: 'Telegram must start with @ and have 5-32 characters (letters, numbers or _)'
            },
            discord: {
                regex: /^[A-Za-z0-9._]{2,32}\d{4}$/,
                message: 'Discord must have 2-32 characters (letters, numbers, . or _) followed by 4 digits'
            },
            instagram: {
                regex: /^@[A-Za-z0-9._]{1,30}$/,
                message: 'Instagram must start with @ and have 1-30 characters (letters, numbers, . or _)'
            }
        };
        
        this.init();
    }
    
    init() {
        // Adicionar dois contatos por padrão
        this.addContact();
        this.addContact();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Botão adicionar contato
        this.addContactBtn.addEventListener('click', () => {
            this.addContact();
        });
        
        // Validação do nome
        this.nomeInput.addEventListener('input', () => {
            this.validateNome();
        });
        
        // Validação dos pronomes
        this.pronomesSelect.addEventListener('change', () => {
            this.validatePronomes();
        });
        
        // Validação do email
        this.emailInput.addEventListener('input', () => {
            this.validateEmail();
        });
        
        this.emailInput.addEventListener('blur', () => {
            this.validateEmail();
        });
        
        // Validação do telefone (sem máscara rígida)
        this.telefoneInput.addEventListener('input', (e) => {
            // Permitir apenas dígitos, +, (, ), - e espaços
            let value = e.target.value.replace(/[^\d+\-()\s]/g, '');
            e.target.value = value;
            this.validateTelefone();
        });
        
        this.telefoneInput.addEventListener('blur', () => {
            this.validateTelefone();
        });
    }
    
    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            this.emailInput.setCustomValidity('Email is required');
            this.emailInput.classList.add('invalid');
        } else if (!emailRegex.test(email)) {
            this.emailInput.setCustomValidity('Invalid email');
            this.emailInput.classList.add('invalid');
        } else {
            this.emailInput.setCustomValidity('');
            this.emailInput.classList.remove('invalid');
        }
    }
    
    validateTelefone() {
        const telefone = this.telefoneInput.value.trim();
        // Verificar se contém pelo menos um dígito
        const hasDigit = /\d/.test(telefone);
        
        if (!telefone) {
            this.telefoneInput.setCustomValidity('Phone is required');
            this.telefoneInput.classList.add('invalid');
        } else if (!hasDigit) {
            this.telefoneInput.setCustomValidity('Phone must contain at least one digit');
            this.telefoneInput.classList.add('invalid');
        } else if (telefone.length > 100) {
            this.telefoneInput.setCustomValidity('Phone too long (maximum 100 characters)');
            this.telefoneInput.classList.add('invalid');
        } else {
            this.telefoneInput.setCustomValidity('');
            this.telefoneInput.classList.remove('invalid');
        }
    }
    
    addContact() {
        this.contacts.push({ valor: '', tipo: 'twitter', favorito: false });
        this.renderContacts();
    }
    
    removeContact(index) {
        this.contacts.splice(index, 1);
        this.renderContacts();
    }
    
    toggleFavorito(index) {
        // Desmarcar todos os favoritos dos contatos opcionais
        this.contacts.forEach(contact => {
            contact.favorito = false;
        });
        
        // Marcar o selecionado como favorito
        this.contacts[index].favorito = true;
        this.renderContacts();
    }
    
    updateContactValue(index, value) {
        this.contacts[index].valor = value;
    }
    
    updateContactType(index, type) {
        this.contacts[index].tipo = type;
        // Atualizar placeholder e validar quando o tipo mudar
        const row = this.contactsList.children[index];
        if (row) {
            const input = row.querySelector('.contact-input');
            const helpMsg = row.querySelector('.contact-help');
            if (input) {
                input.placeholder = this.placeholders[type] || '@usuario';
                // Validar o valor atual com o novo tipo
                this.validateContactInput(index, input.value);
            }
        }
    }
    
    validateContactInput(index, value) {
        const contact = this.contacts[index];
        const validation = this.validations[contact.tipo];
        const row = this.contactsList.children[index];
        const helpMsg = row ? row.querySelector('.contact-help') : null;
        
        if (!value.trim()) {
            if (helpMsg) {
                helpMsg.textContent = '';
                helpMsg.classList.remove('error');
            }
            return true; // Vazio é válido (campo opcional)
        }
        
        if (validation && !validation.regex.test(value.trim())) {
            if (helpMsg) {
                helpMsg.textContent = validation.message;
                helpMsg.classList.add('error');
            }
            return false;
        } else {
            if (helpMsg) {
                helpMsg.textContent = '';
                helpMsg.classList.remove('error');
            }
            return true;
        }
    }
    
    renderContacts() {
        this.contactsList.innerHTML = '';
        
        this.contacts.forEach((contact, index) => {
            const row = document.createElement('div');
            row.className = 'contact-row';
            row.dataset.index = index;
            
            const input = document.createElement('input');
            input.className = 'contact-input';
            input.type = 'text';
            input.placeholder = this.placeholders[contact.tipo] || '@usuario';
            input.value = contact.valor;
            input.setAttribute('aria-label', `Contact ${contact.tipo} value`);
            input.setAttribute('aria-describedby', `contact-help-${index}`);
            input.addEventListener('input', (e) => {
                this.updateContactValue(index, e.target.value);
                this.validateContactInput(index, e.target.value);
            });
            input.addEventListener('blur', () => {
                this.validateContactInput(index, input.value);
            });
            
            const select = document.createElement('select');
            select.className = 'contact-type';
            select.setAttribute('aria-label', 'Tipo de contato');
            select.required = true;
            // Tipos na ordem: Twitter, Telegram, Discord, Instagram
            const types = ['twitter', 'telegram', 'discord', 'instagram'];
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                // Capitalizar primeira letra
                option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
                if (type === contact.tipo) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            select.addEventListener('change', (e) => {
                this.updateContactType(index, e.target.value);
            });
            
            const favBtn = document.createElement('button');
            favBtn.type = 'button';
            favBtn.className = 'contact-fav';
            favBtn.setAttribute('aria-pressed', contact.favorito ? 'true' : 'false');
            favBtn.setAttribute('title', 'Mark as favorite');
            favBtn.textContent = '⭐';
            favBtn.addEventListener('click', () => {
                this.toggleFavorito(index);
            });
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'contact-del';
            delBtn.setAttribute('title', 'Remove contact');
            delBtn.textContent = '🗑️';
            delBtn.addEventListener('click', () => {
                this.removeContact(index);
            });
            
            // Mensagem de ajuda (aria-live)
            const helpMsg = document.createElement('small');
            helpMsg.className = 'contact-help';
            helpMsg.id = `contact-help-${index}`;
            helpMsg.setAttribute('aria-live', 'polite');
            helpMsg.setAttribute('role', 'alert');
            
            row.appendChild(input);
            row.appendChild(select);
            row.appendChild(favBtn);
            row.appendChild(delBtn);
            row.appendChild(helpMsg);
            
            // Validar valor inicial se houver
            if (contact.valor) {
                this.validateContactInput(index, contact.valor);
            }
            
            this.contactsList.appendChild(row);
        });
    }
    
    validateNome() {
        const nome = this.nomeInput.value.trim();
        if (nome.length < 3 && nome.length > 0) {
            this.nomeInput.setCustomValidity('Name must have at least 3 characters');
            this.nomeInput.classList.add('invalid');
        } else if (nome.length === 0) {
            this.nomeInput.setCustomValidity('Required field');
            this.nomeInput.classList.add('invalid');
        } else {
            this.nomeInput.setCustomValidity('');
            this.nomeInput.classList.remove('invalid');
        }
    }
    
    validatePronomes() {
        const pronomes = this.pronomesSelect.value;
        if (!pronomes) {
            this.pronomesSelect.setCustomValidity('Required field');
            this.pronomesSelect.classList.add('invalid');
        } else {
            this.pronomesSelect.setCustomValidity('');
            this.pronomesSelect.classList.remove('invalid');
        }
    }
    
    validate() {
        const nome = this.nomeInput.value.trim();
        const pronomes = this.pronomesSelect.value;
        const email = this.emailInput.value.trim();
        const telefone = this.telefoneInput.value.trim();
        
        if (nome.length < 3) {
            this.nomeInput.classList.add('invalid');
            return { valid: false, error: 'How would you like to be called? is required (minimum 3 characters)' };
        }
        
        if (!pronomes) {
            this.pronomesSelect.classList.add('invalid');
            return { valid: false, error: 'Pronouns is required' };
        }
        
        // Validar email obrigatório
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            this.emailInput.classList.add('invalid');
            return { valid: false, error: 'Email is required' };
        }
        if (!emailRegex.test(email)) {
            this.emailInput.classList.add('invalid');
            return { valid: false, error: 'Invalid email' };
        }
        
        // Validar telefone obrigatório
        const hasDigit = /\d/.test(telefone);
        if (!telefone) {
            this.telefoneInput.classList.add('invalid');
            return { valid: false, error: 'Phone is required' };
        }
        if (!hasDigit) {
            this.telefoneInput.classList.add('invalid');
            return { valid: false, error: 'Phone must contain at least one digit' };
        }
        if (telefone.length > 100) {
            this.telefoneInput.classList.add('invalid');
            return { valid: false, error: 'Phone too long (maximum 100 characters)' };
        }
        
        // Remover classes de erro se tudo estiver válido
        this.nomeInput.classList.remove('invalid');
        this.pronomesSelect.classList.remove('invalid');
        this.emailInput.classList.remove('invalid');
        this.telefoneInput.classList.remove('invalid');
        
        return { valid: true };
    }
    
    getData() {
        return {
            nome: this.nomeInput.value.trim(),
            pronomes: this.pronomesSelect.value,
            email: this.emailInput.value.trim(),
            telefone: this.telefoneInput.value.trim(),
            contatos: this.contacts.map(contact => ({
                valor: contact.valor.trim(),
                tipo: contact.tipo,
                favorito: contact.favorito
            })).filter(contact => contact.valor.length > 0)
        };
    }
}

// ============================================
// OrcamentoForm - Módulo de Formulário de Orçamento
// ============================================
class OrcamentoForm {
    constructor() {
        this.currency = 'USD';
        this.minPrice = 35;
        this.maxPrice = 200;
        this.urgency = null;
        this.urgencyDate = null;
        
        this.currencyBtns = document.querySelectorAll('.currency-btn');
        this.priceTable = document.getElementById('price-table');
        this.rangeMin = document.getElementById('range-min');
        this.rangeMax = document.getElementById('range-max');
        this.priceMinInput = document.getElementById('price-min');
        this.priceMaxInput = document.getElementById('price-max');
        this.priceError = document.getElementById('price-error');
        this.urgencyBtns = document.querySelectorAll('.urgency-btn');
        this.urgencyContent = document.getElementById('urgency-content');
        
        this.priceData = {
            BRL: {
                HeadShot: { min: 'R$ 35', max: 'R$ 60' },
                HalfBody: { min: 'R$ 55', max: 'R$ 90' },
                FullBody: { min: 'R$ 80', max: 'R$ 140' }
            },
            USD: {
                HeadShot: { min: '$ 20', max: '$ 35' },
                HalfBody: { min: '$ 30', max: '$ 50' },
                FullBody: { min: '$ 45', max: '$ 80' }
            },
            EUR: {
                HeadShot: { min: '€ 18', max: '€ 32' },
                HalfBody: { min: '€ 27', max: '€ 45' },
                FullBody: { min: '€ 40', max: '€ 70' }
            }
        };
        
        this.currencySymbols = {
            BRL: 'R$',
            USD: '$',
            EUR: '€'
        };
        
        this.init();
    }
    
    init() {
        this.setupCurrencySelector();
        this.setupRangeSlider();
        this.setupUrgencySelector();
        this.updatePriceTable();
        this.updatePlaceholders();
    }
    
    setupCurrencySelector() {
        this.currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const currency = btn.dataset.currency;
                this.setCurrency(currency);
            });
        });
    }
    
    setCurrency(currency) {
        this.currency = currency;
        
        // Atualizar botões
        this.currencyBtns.forEach(btn => {
            const isActive = btn.dataset.currency === currency;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        
        this.updatePriceTable();
        this.updatePlaceholders();
    }
    
    updatePriceTable() {
        const data = this.priceData[this.currency];
        const symbol = this.currencySymbols[this.currency];
        
        this.priceTable.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Service</th>
                        <th>Min. Price</th>
                        <th>Max. Price</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>HeadShot</td>
                        <td>${data.HeadShot.min}</td>
                        <td>${data.HeadShot.max}</td>
                    </tr>
                    <tr>
                        <td>HalfBody</td>
                        <td>${data.HalfBody.min}</td>
                        <td>${data.HalfBody.max}</td>
                    </tr>
                    <tr>
                        <td>FullBody</td>
                        <td>${data.FullBody.min}</td>
                        <td>${data.FullBody.max}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }
    
    updatePlaceholders() {
        const symbol = this.currencySymbols[this.currency];
        this.priceMinInput.placeholder = `Minimum (${symbol})`;
        this.priceMaxInput.placeholder = `Maximum (${symbol})`;
    }
    
    setupRangeSlider() {
        // Sincronizar range → inputs
        this.rangeMin.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.minPrice = value;
            this.priceMinInput.value = value;
            this.updateRangeTrack();
            this.validatePrice();
        });
        
        this.rangeMax.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.maxPrice = value;
            this.priceMaxInput.value = value;
            this.updateRangeTrack();
            this.validatePrice();
        });
        
        // Sincronizar inputs → range
        this.priceMinInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) || 0;
            if (value >= 0 && value <= 300) {
                this.minPrice = value;
                this.rangeMin.value = value;
                this.updateRangeTrack();
                this.validatePrice();
            }
        });
        
        this.priceMaxInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) || 0;
            if (value >= 0 && value <= 300) {
                this.maxPrice = value;
                this.rangeMax.value = value;
                this.updateRangeTrack();
                this.validatePrice();
            }
        });
        
        // Inicializar valores nos inputs
        this.priceMinInput.value = this.minPrice;
        this.priceMaxInput.value = this.maxPrice;
        
        // Inicializar track
        this.updateRangeTrack();
    }
    
    updateRangeTrack() {
        const track = document.querySelector('.range-track');
        const min = parseInt(this.rangeMin.value);
        const max = parseInt(this.rangeMax.value);
        const range = parseInt(this.rangeMax.max) - parseInt(this.rangeMin.min);
        const left = (min / range) * 100;
        const width = ((max - min) / range) * 100;
        
        track.style.setProperty('--range-left', `${left}%`);
        track.style.setProperty('--range-width', `${width}%`);
    }
    
    validatePrice() {
        const min = this.minPrice;
        const max = this.maxPrice;
        let error = '';
        
        if (min < 0 || max < 0) {
            error = 'Values must be positive';
        } else if (min > 300 || max > 300) {
            error = 'Values must be between 0 and 300';
        } else if (min >= max) {
            error = 'Minimum value must be less than maximum';
        } else if (!min && !max) {
            error = 'Price range is required';
        }
        
        this.priceError.textContent = error;
        
        if (error) {
            this.priceMinInput.classList.add('invalid');
            this.priceMaxInput.classList.add('invalid');
        } else {
            this.priceMinInput.classList.remove('invalid');
            this.priceMaxInput.classList.remove('invalid');
        }
        
        return !error;
    }
    
    setupUrgencySelector() {
        this.urgencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const urgency = btn.dataset.urgency;
                this.setUrgency(urgency);
            });
        });
    }
    
    setUrgency(urgency) {
        this.urgency = urgency;
        
        // Atualizar botões
        this.urgencyBtns.forEach(btn => {
            const isActive = btn.dataset.urgency === urgency;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        
        this.renderUrgencyContent();
    }
    
    renderUrgencyContent() {
        const symbol = this.currencySymbols[this.currency];
        
        if (this.urgency === 'indeterminado') {
            this.urgencyContent.innerHTML = `
                <p>When there are no orders being made, this order will be completed. <strong>Applies 15% discount</strong> to the Budget value.</p>
            `;
        } else if (this.urgency === 'data') {
            const today = new Date();
            const minDate = new Date(today);
            minDate.setDate(today.getDate() + 20);
            const minDateStr = minDate.toISOString().split('T')[0];
            
            this.urgencyContent.innerHTML = `
                <p>Choose a date (min. 20 days).</p>
                <input type="date" id="urgency-date" min="${minDateStr}" aria-label="Delivery date">
            `;
            
            const dateInput = document.getElementById('urgency-date');
            dateInput.addEventListener('change', (e) => {
                this.urgencyDate = e.target.value;
            });
        } else if (this.urgency === 'urgente') {
            this.urgencyContent.innerHTML = `
                <p>The order will be completed as soon as possible, <strong>not exceeding 20 days</strong>. <strong>Applies 15% more</strong> to the Budget value.</p>
            `;
        } else {
            this.urgencyContent.innerHTML = '';
        }
    }
    
    validate() {
        if (!this.validatePrice()) {
            return { valid: false, error: 'Invalid price range' };
        }
        
        if (!this.urgency) {
            return { valid: false, error: 'Select an urgency option' };
        }
        
        if (this.urgency === 'data' && !this.urgencyDate) {
            return { valid: false, error: 'Select a delivery date' };
        }
        
        return { valid: true };
    }
    
    getData() {
        return {
            moeda: this.currency,
            faixaPreco: {
                minimo: this.minPrice,
                maximo: this.maxPrice
            },
            urgencia: {
                tipo: this.urgency,
                data: this.urgencyDate || null
            }
        };
    }
}

// ============================================
// TermosForm - Módulo de Formulário de Termos
// ============================================
class TermosForm {
    constructor() {
        this.idadeCheckbox = document.getElementById('termos-idade');
        this.concordanciaCheckbox = document.getElementById('termos-concordancia');
        this.tosTextElement = document.getElementById('tos-text');
        this.lawTextElement = document.getElementById('law-text');
        
        this.setupEventListeners();
        this.loadTerms();
    }
    
    async loadTerms() {
        try {
            // Carregar TOS.md
            const tosResponse = await fetch('archive/TOS.md');
            if (tosResponse.ok) {
                const tosText = await tosResponse.text();
                this.tosTextElement.innerHTML = this.formatText(tosText);
            } else {
                this.tosTextElement.textContent = 'Error loading Terms of Service.';
            }
            
            // Carregar LAW.md
            const lawResponse = await fetch('archive/LAW.md');
            if (lawResponse.ok) {
                const lawText = await lawResponse.text();
                this.lawTextElement.innerHTML = this.formatText(lawText);
            } else {
                this.lawTextElement.textContent = 'Error loading Legal Terms.';
            }
        } catch (error) {
            console.error('Error loading terms:', error);
            this.tosTextElement.textContent = 'Error loading Terms of Service.';
            this.lawTextElement.textContent = 'Error loading Legal Terms.';
        }
    }
    
    formatText(text) {
        // Converter markdown básico (**texto** para <strong>texto</strong>)
        // Processar linha por linha para melhor formatação
        const lines = text.split('\n');
        let html = '';
        let inParagraph = false;
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Linha vazia - fechar parágrafo se estiver aberto
            if (trimmedLine === '') {
                if (inParagraph) {
                    html += '</p>';
                    inParagraph = false;
                }
                return;
            }
            
            // Converter **texto** para <strong>texto</strong>
            const formattedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Se a linha começa com ** (título), criar um parágrafo especial
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                if (inParagraph) {
                    html += '</p>';
                }
                html += `<p class="termos-section-title">${formattedLine}</p>`;
                inParagraph = false;
            } else {
                // Linha normal de texto
                if (!inParagraph) {
                    html += '<p>';
                    inParagraph = true;
                } else {
                    html += '<br>';
                }
                html += formattedLine;
            }
        });
        
        // Fechar parágrafo se ainda estiver aberto
        if (inParagraph) {
            html += '</p>';
        }
        
        return html;
    }
    
    setupEventListeners() {
        // Validação em tempo real
        this.idadeCheckbox.addEventListener('change', () => {
            this.validate();
        });
        
        this.concordanciaCheckbox.addEventListener('change', () => {
            this.validate();
        });
    }
    
    validate() {
        const idadeChecked = this.idadeCheckbox.checked;
        const concordanciaChecked = this.concordanciaCheckbox.checked;
        
        if (!idadeChecked) {
            this.idadeCheckbox.classList.add('invalid');
        } else {
            this.idadeCheckbox.classList.remove('invalid');
        }
        
        if (!concordanciaChecked) {
            this.concordanciaCheckbox.classList.add('invalid');
        } else {
            this.concordanciaCheckbox.classList.remove('invalid');
        }
        
        return idadeChecked && concordanciaChecked;
    }
    
    getData() {
        return {
            maiorIdade: this.idadeCheckbox.checked,
            concordancia: this.concordanciaCheckbox.checked
        };
    }
}

// ============================================
// KattyArtwork - Aplicação Principal
// ============================================

// Configuração inicial
const CONFIG = {
    site: 'KattyArtwork',
    dominio: 'kattyartwork.com',
    maxCharacters: 10,
    minCharacters: 1
};

// Estado da aplicação
let charactersData = [];
let characterIdCounter = 1;
let clienteForm = null;
let orcamentoForm = null;
let termosForm = null;
let artesForm = null;

// ============================================
// Inicialização
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    const submitBtn = document.getElementById('submit-btn');
    const addCharacterBtn = document.getElementById('btn-add-character');
    
    // Inicializar formulários
    clienteForm = new ClienteForm();
    orcamentoForm = new OrcamentoForm();
    termosForm = new TermosForm();
    artesForm = new ArtesForm();
    
    // Event listener para adicionar personagem
    addCharacterBtn.addEventListener('click', addCharacter);
    
    // Event listener para envio do briefing
    submitBtn.addEventListener('click', handleSubmit);
    
    // Inicializar com 1 personagem
    addCharacter();
}

// ============================================
// Gerenciamento de Cards de Personagens
// ============================================
function addCharacter() {
    const container = document.getElementById('characters-container');
    const characterId = characterIdCounter++;
    const index = charactersData.length + 1;
    const characterData = {
        id: characterId,
        nome: '',
        genital: '',
        sexuality: '',
        pronoun: '',
        descricao: '',
        cores: [],
        referencias: []
    };
    
    charactersData.push(characterData);
    const card = createCharacterCard(characterData, index);
    container.appendChild(card);
    
    // Scroll horizontal suave para o novo card
    setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
    }, 100);
}

function createCharacterCard(characterData, index) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.dataset.characterId = characterData.id;
    
    card.innerHTML = `
        <div class="character-header">
            <input 
                type="text" 
                class="character-title-input" 
                value="${characterData.nome || ''}" 
                placeholder="Character's Name"
                aria-label="Character ${index} name - Edit to enter the character's name"
            />
            <div class="card-actions">
                <button class="btn-icon duplicate-btn" aria-label="Duplicate character ${index}">
                    📋 Duplicate
                </button>
                <button class="btn-icon delete-btn" aria-label="Delete character ${index}">
                    🗑️ Delete
                </button>
            </div>
        </div>
        
        <div class="character-info-fields">
            <div class="info-field">
                <label for="genital-${characterData.id}" class="info-label">Genital</label>
                <input 
                    type="text" 
                    id="genital-${characterData.id}" 
                    class="info-input" 
                    placeholder="e.g., Male, Female, Other"
                    aria-label="Character ${index} genital"
                />
            </div>
            <div class="info-field">
                <label for="sexuality-${characterData.id}" class="info-label">Sexuality</label>
                <input 
                    type="text" 
                    id="sexuality-${characterData.id}" 
                    class="info-input" 
                    placeholder="e.g., Straight, Gay, Bisexual"
                    aria-label="Character ${index} sexuality"
                />
            </div>
            <div class="info-field">
                <label for="pronoun-${characterData.id}" class="info-label">Pronoun</label>
                <input 
                    type="text" 
                    id="pronoun-${characterData.id}" 
                    class="info-input" 
                    placeholder="e.g., He/Him, She/Her, They/Them"
                    aria-label="Character ${index} pronoun"
                />
            </div>
        </div>
        
        <div class="upload-section">
            <label class="upload-label">Character visual references 🖼️</label>
            <div class="upload-area" role="button" tabindex="0" aria-label="Image upload area">
                <div class="upload-icon">📎</div>
                <div class="upload-text">Drag images here or click to select</div>
                <input type="file" class="upload-input" multiple accept="image/*" aria-label="Select images">
            </div>
            <div class="thumbnails-container"></div>
        </div>
        
        <div class="description-section">
            <label for="description-${characterData.id}" class="description-label">
                Character description 📝
            </label>
            <textarea 
                id="description-${characterData.id}" 
                class="description-textarea" 
                placeholder="What is this character like? Default mood, things they like to do, things they don't like, personality, typical expressions…"
                aria-label="Character ${index} description"
            ></textarea>
            <div class="char-counter">
                <span class="char-count">0</span> characters
            </div>
        </div>
        
        <div class="colors-section">
            <label class="colors-label">
                Character main colors 🎨
            </label>
            <div class="color-picker-container" data-character-id="${characterData.id}"></div>
            <div class="color-chips"></div>
        </div>
    `;
    
    // Configurar event listeners do card
    setupCardEventListeners(card, characterData, index);
    
    return card;
}

// ============================================
// Configuração de Event Listeners do Card
// ============================================
function setupCardEventListeners(card, characterData, index) {
    // Upload de imagens
    const uploadArea = card.querySelector('.upload-area');
    const uploadInput = card.querySelector('.upload-input');
    const thumbnailsContainer = card.querySelector('.thumbnails-container');
    
    // Click no upload area
    uploadArea.addEventListener('click', () => {
        uploadInput.click();
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        handleImageUpload(files, characterData, thumbnailsContainer);
    });
    
    // Seleção de arquivos
    uploadInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleImageUpload(files, characterData, thumbnailsContainer);
    });
    
    // Nome do personagem (título editável)
    const titleInput = card.querySelector('.character-title-input');
    titleInput.addEventListener('input', () => {
        characterData.nome = titleInput.value.trim();
    });
    
    // Campos de informação (Genital, Sexuality, Pronoun)
    const genitalInput = card.querySelector(`#genital-${characterData.id}`);
    const sexualityInput = card.querySelector(`#sexuality-${characterData.id}`);
    const pronounInput = card.querySelector(`#pronoun-${characterData.id}`);
    
    genitalInput.addEventListener('input', () => {
        characterData.genital = genitalInput.value.trim();
    });
    
    sexualityInput.addEventListener('input', () => {
        characterData.sexuality = sexualityInput.value.trim();
    });
    
    pronounInput.addEventListener('input', () => {
        characterData.pronoun = pronounInput.value.trim();
    });
    
    // Descrição com contador de caracteres
    const textarea = card.querySelector('.description-textarea');
    const charCounter = card.querySelector('.char-counter');
    const charCount = card.querySelector('.char-count');
    
    textarea.addEventListener('input', () => {
        const length = textarea.value.length;
        charCount.textContent = length;
        
        charCounter.classList.remove('warning', 'error');
        if (length > 1000) {
            charCounter.classList.add('error');
        } else if (length > 500) {
            charCounter.classList.add('warning');
        }
        
        characterData.descricao = textarea.value;
    });
    
    // Color Picker
    const colorPickerContainer = card.querySelector('.color-picker-container');
    const colorChips = card.querySelector('.color-chips');
    
    // Criar instância do ColorPicker
    const colorPicker = new ColorPicker(colorPickerContainer, {
        onAddColor: (hex) => {
            // Verificar se a cor já existe
            if (characterData.cores.includes(hex)) {
                return false;
            }
            // Adicionar cor
            characterData.cores.push(hex);
            createColorChip(hex, characterData, colorChips);
            return true;
        }
    });
    
    // Armazenar referência do color picker no card
    card.colorPicker = colorPicker;
    
    // Botões de ação do card
    const duplicateBtn = card.querySelector('.duplicate-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    
    duplicateBtn.addEventListener('click', () => {
        duplicateCharacterCard(characterData, index);
    });
    
    deleteBtn.addEventListener('click', () => {
        deleteCharacterCard(card, characterData);
    });
}

// ============================================
// Upload e Gerenciamento de Imagens
// ============================================
function handleImageUpload(files, characterData, thumbnailsContainer) {
    files.forEach(file => {
        if (!file.type.startsWith('image/')) {
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = {
                name: file.name,
                size: file.size,
                type: file.type,
                dataURL: e.target.result
            };
            
            characterData.referencias.push(imageData);
            createThumbnail(imageData, characterData, thumbnailsContainer);
        };
        
        reader.readAsDataURL(file);
    });
}

function createThumbnail(imageData, characterData, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'thumbnail-wrapper';
    
    const img = document.createElement('img');
    img.src = imageData.dataURL;
    img.className = 'thumbnail-image';
    img.alt = imageData.name;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'thumbnail-remove';
    removeBtn.innerHTML = '×';
    removeBtn.setAttribute('aria-label', `Remover imagem ${imageData.name}`);
    removeBtn.addEventListener('click', () => {
        const index = characterData.referencias.findIndex(ref => ref.dataURL === imageData.dataURL);
        if (index > -1) {
            characterData.referencias.splice(index, 1);
        }
        wrapper.remove();
    });
    
    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
}

// ============================================
// Gerenciamento de Cores
// ============================================

function createColorChip(color, characterData, container) {
    const chip = document.createElement('div');
    chip.className = 'color-chip';
    
    const preview = document.createElement('div');
    preview.className = 'color-preview';
    preview.style.backgroundColor = color;
    
    const code = document.createElement('span');
    code.className = 'color-code';
    code.textContent = color.toUpperCase();
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'color-chip-remove';
    removeBtn.innerHTML = '×';
    removeBtn.setAttribute('aria-label', `Remover cor ${color}`);
    removeBtn.addEventListener('click', () => {
        const index = characterData.cores.indexOf(color);
        if (index > -1) {
            characterData.cores.splice(index, 1);
        }
        chip.remove();
    });
    
    chip.appendChild(preview);
    chip.appendChild(code);
    chip.appendChild(removeBtn);
    container.appendChild(chip);
}

// ============================================
// Ações do Card
// ============================================
function duplicateCharacterCard(originalData, index) {
    const container = document.getElementById('characters-container');
    
    // Criar novo personagem com dados duplicados
    const newCharacterId = characterIdCounter++;
    const duplicatedData = {
        id: newCharacterId,
        nome: originalData.nome ? `${originalData.nome} (Copy)` : `Character ${newCharacterId}`,
        genital: originalData.genital || '',
        sexuality: originalData.sexuality || '',
        pronoun: originalData.pronoun || '',
        descricao: originalData.descricao,
        cores: [...originalData.cores],
        referencias: originalData.referencias.map(ref => ({ ...ref }))
    };
    
    charactersData.push(duplicatedData);
    
    // Encontrar o índice do card original
    const cards = Array.from(container.children);
    const originalIndex = charactersData.findIndex(c => c.id === originalData.id);
    const newIndex = originalIndex + 1;
    
    const newCard = createCharacterCard(duplicatedData, newIndex);
    
    // Inserir após o card original
    if (originalIndex < cards.length - 1) {
        container.insertBefore(newCard, cards[originalIndex + 1]);
    } else {
        container.appendChild(newCard);
    }
    
    // Atualizar títulos dos cards
    updateCardTitles();
    
    // Restaurar dados visuais no novo card
    restoreCardData(newCard, duplicatedData);
    
    // Scroll horizontal suave para o novo card
    setTimeout(() => {
        newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
    }, 100);
}

function deleteCharacterCard(card, characterData) {
    if (!confirm('Are you sure you want to delete this character?')) {
        return;
    }
    
    // Remover dos dados
    const index = charactersData.findIndex(c => c.id === characterData.id);
    if (index > -1) {
        charactersData.splice(index, 1);
    }
    
    // Remover o card do DOM
    card.remove();
    
    // Atualizar títulos dos cards restantes
    updateCardTitles();
    
    // Verificar se não há mais personagens e adicionar um novo se necessário
    if (charactersData.length === 0) {
        addCharacter();
    }
}

function updateCardTitles() {
    // Função mantida para compatibilidade, mas títulos agora são editáveis
    // Não precisa mais atualizar automaticamente
}

function restoreCardData(card, characterData) {
    // Restaurar nome
    const titleInput = card.querySelector('.character-title-input');
    if (titleInput) {
        titleInput.value = characterData.nome || '';
    }
    
    // Restaurar campos de informação
    const genitalInput = card.querySelector(`#genital-${characterData.id}`);
    const sexualityInput = card.querySelector(`#sexuality-${characterData.id}`);
    const pronounInput = card.querySelector(`#pronoun-${characterData.id}`);
    
    if (genitalInput) genitalInput.value = characterData.genital || '';
    if (sexualityInput) sexualityInput.value = characterData.sexuality || '';
    if (pronounInput) pronounInput.value = characterData.pronoun || '';
    
    // Restaurar descrição
    const textarea = card.querySelector('.description-textarea');
    textarea.value = characterData.descricao;
    const charCount = card.querySelector('.char-count');
    charCount.textContent = characterData.descricao.length;
    
    // Restaurar cores
    const colorChips = card.querySelector('.color-chips');
    characterData.cores.forEach(color => {
        createColorChip(color, characterData, colorChips);
    });
    
    // Restaurar imagens
    const thumbnailsContainer = card.querySelector('.thumbnails-container');
    characterData.referencias.forEach(ref => {
        createThumbnail(ref, characterData, thumbnailsContainer);
    });
    
    // Restaurar color picker (resetar para primeira cor ou padrão)
    if (card.colorPicker) {
        if (characterData.cores.length > 0) {
            card.colorPicker.setColor(characterData.cores[0]);
        } else {
            card.colorPicker.setColor('#000000');
        }
    }
}

// ============================================
// ArtesForm - Módulo de Formulário de Artes
// ============================================
class ArtesForm {
    constructor() {
        this.artes = [];
        this.arteIdCounter = 0;
        this.container = document.getElementById('artes-container');
        this.btnAdd = document.getElementById('btn-add-arte');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        // Adicionar primeira arte automaticamente
        this.addArte();
    }
    
    setupEventListeners() {
        this.btnAdd.addEventListener('click', () => {
            this.addArte();
        });
    }
    
    addArte() {
        const arteId = this.arteIdCounter++;
        const arteData = {
            id: arteId,
            descricao: '',
            referencias: []
        };
        
        this.artes.push(arteData);
        this.renderArte(arteData);
    }
    
    removeArte(arteId) {
        const index = this.artes.findIndex(a => a.id === arteId);
        if (index !== -1) {
            this.artes.splice(index, 1);
            const arteElement = this.container.querySelector(`[data-arte-id="${arteId}"]`);
            if (arteElement) {
                arteElement.remove();
            }
            this.updateArteTitles();
        }
    }
    
    renderArte(arteData) {
        const arteItem = document.createElement('div');
        arteItem.className = 'arte-item';
        arteItem.dataset.arteId = arteData.id;
        
        const arteIndex = this.artes.findIndex(a => a.id === arteData.id) + 1;
        
        arteItem.innerHTML = `
            <div class="arte-item-header">
                <span class="arte-item-title">Artwork n° ${arteIndex}</span>
                <button type="button" class="arte-remove-btn" aria-label="Remove art ${arteIndex}">
                    🗑️ Remove
                </button>
            </div>
            <div class="arte-upload-section">
                <div class="arte-upload-area" role="button" tabindex="0" aria-label="Artwork ${arteIndex} reference files upload area">
                    <div class="arte-upload-icon">📎</div>
                    <div class="arte-upload-text">Drag reference files here or click to select</div>
                    <input type="file" class="arte-upload-input" multiple accept="image/*" aria-label="Select reference files for artwork ${arteIndex}">
                </div>
                <div class="arte-thumbnails-container" id="arte-thumbnails-${arteData.id}"></div>
            </div>
            <textarea 
                class="arte-textarea" 
                id="arte-${arteData.id}"
                placeholder="Explain here how you would like the background, pose, items, and what the characters are doing to be. This is not the character description area."
                aria-label="Art ${arteIndex} description"
            >${arteData.descricao}</textarea>
            <div class="arte-char-counter">
                <span class="arte-char-count" id="arte-count-${arteData.id}">0</span> characters
            </div>
        `;
        
        // Event listeners
        const textarea = arteItem.querySelector('.arte-textarea');
        const charCount = arteItem.querySelector('.arte-char-count');
        const removeBtn = arteItem.querySelector('.arte-remove-btn');
        
        // Upload de arquivos de referência
        const uploadArea = arteItem.querySelector('.arte-upload-area');
        const uploadInput = arteItem.querySelector('.arte-upload-input');
        const thumbnailsContainer = arteItem.querySelector('.arte-thumbnails-container');
        
        // Click no upload area
        uploadArea.addEventListener('click', () => {
            uploadInput.click();
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            this.handleArteImageUpload(files, arteData, thumbnailsContainer);
        });
        
        // Seleção de arquivos
        uploadInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleArteImageUpload(files, arteData, thumbnailsContainer);
        });
        
        // Atualizar contador de caracteres
        textarea.addEventListener('input', (e) => {
            const length = e.target.value.length;
            charCount.textContent = length;
            arteData.descricao = e.target.value;
        });
        
        // Remover arte
        removeBtn.addEventListener('click', () => {
            this.removeArte(arteData.id);
        });
        
        // Inicializar contador
        charCount.textContent = arteData.descricao.length;
        
        this.container.appendChild(arteItem);
    }
    
    updateArteTitles() {
        const arteItems = this.container.querySelectorAll('.arte-item');
        arteItems.forEach((item, index) => {
            const title = item.querySelector('.arte-item-title');
            if (title) {
                title.textContent = `Arte ${index + 1}`;
            }
        });
    }
    
    handleArteImageUpload(files, arteData, thumbnailsContainer) {
        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    dataURL: e.target.result
                };
                
                arteData.referencias.push(imageData);
                this.createArteThumbnail(imageData, arteData, thumbnailsContainer);
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    createArteThumbnail(imageData, arteData, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'arte-thumbnail-wrapper';
        
        const img = document.createElement('img');
        img.src = imageData.dataURL;
        img.className = 'arte-thumbnail-image';
        img.alt = imageData.name;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'arte-thumbnail-remove';
        removeBtn.innerHTML = '×';
        removeBtn.setAttribute('aria-label', `Remove reference ${imageData.name}`);
        removeBtn.addEventListener('click', () => {
            const index = arteData.referencias.findIndex(ref => ref.dataURL === imageData.dataURL);
            if (index > -1) {
                arteData.referencias.splice(index, 1);
            }
            wrapper.remove();
        });
        
        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        container.appendChild(wrapper);
    }
    
    getData() {
        return this.artes.map(arte => ({
            descricao: arte.descricao,
            referencias: arte.referencias || []
        })).filter(arte => arte.descricao.trim().length > 0 || (arte.referencias && arte.referencias.length > 0));
    }
}

// ============================================
// Envio do Briefing
// ============================================
const API_URL = "https://orders-api-652400782573.southamerica-east1.run.app/orders"; // atualize após mapear o domínio

async function enviarPedido(formData) {
    // reCAPTCHA v3 — executa no "action: submit"
    const captchaToken = await grecaptcha.execute("6LdVewcsAAAAAH2u_M7AxGUEQdvTiONNRwv4B0AX", { action: "submit" });

    const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, captchaToken })
    });

    const data = await resp.json();
    if (!resp.ok) {
        console.error("Erro API:", data);
        throw new Error(data.error || "Erro ao enviar");
    }
    return data;
}

function validateForm(form, errorMessage) {
    if (!form) return true;
    const validation = form.validate();
    if (!validation.valid) {
        alert(`❌ ${errorMessage || validation.error}`);
        return false;
    }
    return true;
}

async function handleSubmit() {
    // Validar todos os formulários
    if (!validateForm(clienteForm)) return;
    if (!validateForm(orcamentoForm)) return;
    
    if (termosForm && !termosForm.validate()) {
        alert('❌ You must accept all terms of service to continue');
        return;
    }
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    
    try {
        // Montar payload adaptado para a API
        const clienteData = clienteForm ? clienteForm.getData() : null;
        const artesData = artesForm ? artesForm.getData() : [];
        
        // Preparar dados no formato esperado pela API
        const formData = {
            cliente: {
                nome: clienteData ? clienteData.nome : '',
                email: clienteData ? clienteData.email : '',
                redes: clienteData && clienteData.contatos && clienteData.contatos.length > 0
                    ? clienteData.contatos.map(c => `${c.tipo}: ${c.valor}`).join(', ')
                    : ""
            },
            pedido: {
                tipo: artesData.length > 0 ? 'artwork' : 'custom',
                descricao: artesData.length > 0 
                    ? artesData.map((arte, idx) => `Arte ${idx + 1}: ${arte.descricao || 'Sem descrição'}`).join('\n\n')
                    : '',
                // Coletar referências de todas as artes
                referencias: artesData.flatMap(arte => 
                    (arte.referencias || []).map(ref => ref.dataURL || ref)
                ).filter(Boolean)
            },
            metadata: {
                origem: "site-oficial",
                site: CONFIG.site,
                dominio: CONFIG.dominio,
                orcamento: orcamentoForm ? orcamentoForm.getData() : null,
                termos: termosForm ? termosForm.getData() : null,
                quantidade: charactersData.length,
                personagens: charactersData.map(char => ({
                    id: char.id,
                    nome: char.nome || '',
                    genital: char.genital || '',
                    sexuality: char.sexuality || '',
                    pronoun: char.pronoun || '',
                    descricao: char.descricao,
                    cores: char.cores,
                    referencias: char.referencias
                }))
            }
        };
        
        // Enviar para a API
        const result = await enviarPedido(formData);
        
        // Exibir no console
        console.log('📦 Briefing Enviado:', formData);
        console.log('✅ Resposta da API:', result);
        
        // Mostrar mensagem de sucesso
        showSuccessMessage(result.id || 'enviado com sucesso');
        
        // Scroll para a mensagem
        const successMessage = document.getElementById('success-message');
        successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
    } catch (err) {
        console.error('Erro ao enviar pedido:', err);
        alert("Falha ao enviar pedido. Tente novamente.");
    } finally {
        submitBtn.disabled = false;
    }
}

function showSuccessMessage(orderId) {
    const successMessage = document.getElementById('success-message');
    if (orderId && typeof orderId === 'string' && orderId !== 'enviado com sucesso') {
        successMessage.textContent = `🎉 Pedido enviado! ID: ${orderId}`;
    } else {
        successMessage.textContent = '🎉 Briefing submitted! Thank you!';
    }
    successMessage.classList.add('show');
    
    // Remover mensagem após 5 segundos
    setTimeout(() => {
        successMessage.classList.remove('show');
    }, 5000);
}



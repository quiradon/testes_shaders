// Gerenciamento de efeitos
class EffectsManager {
  constructor() {
    this.activeEffects = [];
    this.settingPointForEffectId = null;
    this.paintingEffectId = null;
    this.MAX_EFFECTS = 15;
    this.TWO_PI = Math.PI * 2;
    this.EFFECT_TYPE_BREATHING = 1;
    this.EFFECT_TYPE_MASK_SWAY = 2;
    this.EFFECT_TYPE_EXCLUSION_MASK = 3;
    this.EFFECT_TYPE_WAVE = 4;
    this.EFFECT_TYPE_SABER = 5;
    
    // Controle global de animação
    this.animationEnabled = true;
    
    this.elements = {
      activeEffectsList: document.getElementById('active-effects-list'),
      noEffectsText: document.getElementById('no-effects-text'),
      canvas: document.getElementById('canvas'),
      animationToggle: document.getElementById('animationToggle'),
      animationToggleText: document.getElementById('animationToggleText')
    };
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Toggle de animação global
    if (this.elements.animationToggle) {
      this.elements.animationToggle.addEventListener('click', () => {
        this.toggleAnimation();
      });
    }
    
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancelCurrentAction();
      } else if (e.key === 'e' || e.key === 'E') {
        // Alternar borracha no efeito ativo
        if (this.paintingEffectId !== null) {
          // Se estiver pintando uma exclusão, usar o BrushToolsManager
          if (String(this.paintingEffectId).startsWith('exclusion_')) {
            if (brushToolsManager.currentEffect && brushToolsManager.isOpen) {
              const currentEraseState = this.getExclusionBrushErase(this.paintingEffectId);
              brushToolsManager.setBrushMode(!currentEraseState);
            }
          } else {
            // Para efeitos normais, alternar diretamente e atualizar o BrushToolsManager se estiver aberto
            this.toggleEraser(this.paintingEffectId);
            if (brushToolsManager.currentEffect && brushToolsManager.isOpen) {
              brushToolsManager.updateModeButtons();
            }
          }
        }
      } else if (e.key === ' ' && !e.target.matches('input, textarea')) {
        // Barra de espaço para toggle de animação
        e.preventDefault();
        this.toggleAnimation();
      }
    });
  }

  createEffect(type) {
    if (type === 'maskSway') {
      return {
        id: Date.now() + Math.random(),
        type,
        strength: 0.005, // Reduzido de 0.008 para movimento mais sutil
        speed: 1.0, // Reduzido de 1.5 para movimento mais lento e suave
        noiseScale: 0.8, // Reduzido de 1.5 para ondas mais amplas e suaves
        align: 0.5, // Não usado no novo algoritmo, mas mantido
        wind: { x: 0.005, y: 0.002 }, // Reduzido para drift mais sutil
        phase: 0.0,
        showPreview: true, // Será atualizado baseado no estado do collapse
        expanded: true,
        // Canvas e contexto próprios para a máscara deste efeito
        maskCanvas: null,
        maskCtx: null,
        maskTexture: null,
        brush: {
          size: 20,
          hardness: 1.0,
          erase: false
        },
        exclusionMask: {
          enabled: false,
          brush: {
            size: 30,
            hardness: 0.8,
            erase: false
          }
        }
      };
    } else if (type === 'wave') {
      return {
        id: Date.now() + Math.random(),
        type,
        strength: 0.015,
        radius: 0.3,
        softness: 0.3,
        speed: 2.0,
        phase: 0.0,
        marker: { x: 0.5, y: 0.5 },
        showPreview: true,
        expanded: true,
        waveSize: 15.0,           // Tamanho das ondas
        waveDirection: { x: 1.0, y: 0.0 }, // Direção das ondas (horizontal por padrão)
        // Máscara pintável para definir área afetada
        maskCanvas: null,
        maskCtx: null,
        maskTexture: null,
        brush: {
          size: 20,
          hardness: 1.0,
          erase: false
        },
        exclusionMask: {
          enabled: false,
          brush: {
            size: 30,
            hardness: 0.8,
            erase: false
          }
        }
      };
    } else if (type === 'saber') {
      return {
        id: Date.now() + Math.random(),
        type,
        strength: 0.025,          // Reduzir de 0.040 para 0.025 - ainda visível mas menos intenso
        speed: 1.2,               // fireSpeed
        phase: 0.0,
        turbulence: 0.8,          // noiseMultiplier/distortionPower
        color: '#ff6b35',         // outerColorBase
        fuzziness: 0.4,           // fuzziness (suavização das bordas)
        baseSize: 1.2,            // baseSize (largura da chama)
        verticalFalloff: 2.0,     // innerVerticalFalloff (como a chama diminui verticalmente)
        pulseIntensity: 1.0,      // intensidade da pulsação de cor
        showPreview: true,
        expanded: true,
        // Máscara pintável para definir área afetada
        maskCanvas: null,
        maskCtx: null,
        maskTexture: null,
        brush: {
          size: 30,
          hardness: 0.8,
          erase: false
        },
        exclusionMask: {
          enabled: false,
          brush: {
            size: 30,
            hardness: 0.8,
            erase: false
          }
        }
      };
    } else {
      return {
        id: Date.now() + Math.random(),
        type,
        strength: 0.03,
        radius: 0.4,
        softness: 0.4,
        speed: 1.5,
        phase: 0.0,
        marker: { x: 0.5, y: 0.5 },
        showPreview: true, // Será atualizado baseado no estado do collapse
        expanded: true,
        exclusionMask: {
          enabled: false,
          brush: {
            size: 30,
            hardness: 0.8,
            erase: false
          }
        }
      };
    }
  }

  addEffect(type) {
    console.log('Adicionando efeito:', type);
    
    if (this.activeEffects.length >= this.MAX_EFFECTS) {
      this.showNotification('Limite de efeitos atingido.', 'warning');
      return;
    }

    const newEffect = this.createEffect(type);
    if (newEffect) {
      this.activeEffects.push(newEffect);
      console.log('Efeito criado:', newEffect);
      
      // Se for um efeito de máscara, definir como ativo automaticamente
      if (type === 'maskSway' || type === 'wave' || type === 'saber') {
        // Cancelar qualquer pintura anterior
        this.cancelCurrentAction();
        
        // Garantir que a máscara seja inicializada
        if (window.renderer && window.renderer.elements && window.renderer.elements.canvas) {
          const w = window.renderer.elements.canvas.width;
          const h = window.renderer.elements.canvas.height;
          
          if (w > 0 && h > 0) {
            window.renderer.ensureEffectMaskCanvas(newEffect, w, h);
          }
        }
        
        // Definir o novo efeito como ativo para pintura
        this.paintingEffectId = newEffect.id;
        this.updateCursor();
        
        // Abrir o painel de brush tools automaticamente
        if (newEffect.brush) {
          brushToolsManager.open(newEffect);
        }
      }
      
      this.renderEffectsUI();
      
      const effectName = type === 'breathing' ? 'Respiração' : 
                        type === 'maskSway' ? 'Cabelo (Máscara Individual)' : 
                        type === 'wave' ? 'Ondulação' : 
                        type === 'saber' ? 'Saber' : 'Efeito';
      if (type === 'maskSway' || type === 'wave' || type === 'saber') {
        this.showNotification(`${effectName} adicionado e ativo! 🎨 Comece a pintar a máscara.`, 'success');
      } else {
        this.showNotification(`${effectName} adicionado!`, 'success');
      }
    }
  }

  getActiveEffects() {
    return this.activeEffects;
  }

  removeEffect(id) {
    const index = this.activeEffects.findIndex(e => e.id === id);
    if (index !== -1) {
      const effect = this.activeEffects[index];
      
      // Verificar se estamos pintando este efeito ou sua exclusão e fechar o pincel
      if (this.paintingEffectId === id || this.paintingEffectId === `exclusion_${id}`) {
        brushToolsManager.close();
      }
      
      // Limpar listeners do collapse se existirem
      if (effect._shownListener || effect._hiddenListener) {
        const collapseElement = document.getElementById(`collapse-${effect.id}`);
        if (collapseElement) {
          collapseElement.removeEventListener('shown.bs.collapse', effect._shownListener);
          collapseElement.removeEventListener('hidden.bs.collapse', effect._hiddenListener);
        }
      }
      
      // Limpar texturas de máscara se existirem
      if (effect.maskTexture && webglRenderer.gl) {
        webglRenderer.gl.deleteTexture(effect.maskTexture);
        effect.maskTexture = null;
      }
      
      this.activeEffects.splice(index, 1);
      this.renderEffectsUI();
      this.showNotification('Efeito removido!', 'info');
    }
  }

  updateEffect(id, property, value) {
    const effect = this.activeEffects.find(e => e.id === id);
    if (!effect) return;
    
    if (property === 'windX') {
      if (!effect.wind) effect.wind = { x: 0, y: 0 };
      effect.wind.x = parseFloat(value);
    } else if (property === 'windY') {
      if (!effect.wind) effect.wind = { x: 0, y: 0 };
      effect.wind.y = parseFloat(value);
    } else if (property === 'waveDirectionX') {
      if (!effect.waveDirection) effect.waveDirection = { x: 1.0, y: 0.0 };
      effect.waveDirection.x = parseFloat(value);
    } else if (property === 'waveDirectionY') {
      if (!effect.waveDirection) effect.waveDirection = { x: 1.0, y: 0.0 };
      effect.waveDirection.y = parseFloat(value);
    } else if (property === 'color') {
      effect.color = value; // Manter como string para cores
    } else {
      effect[property] = parseFloat(value);
    }
    
    // Atualizar label específico no DOM sem re-renderizar toda a UI
    this.updateEffectLabel(id, property, value);
  }

  updateEffectLabel(effectId, property, value) {
    // Encontrar o efeito para determinar o tipo correto de label
    const effect = this.activeEffects.find(e => e.id === effectId);
    if (!effect) return;
    
    let labelText = '';
    const numValue = parseFloat(value);
    
    switch (property) {
      case 'strength':
        if (effect.type === 'breathing') {
          labelText = `Intensidade: ${Math.round(numValue * 5000)/10}`;
        } else if (effect.type === 'maskSway') {
          labelText = `Força: ${Math.round(numValue * 2000)}`;
        } else if (effect.type === 'wave') {
          labelText = `Intensidade: ${Math.round(numValue * 1000)/10}`;
        } else if (effect.type === 'saber') {
          labelText = `Intensidade: ${Math.round(numValue * 1250)/10}`;
        }
        break;
      case 'radius':
        labelText = `Raio: ${Math.round(numValue * 100)}%`;
        break;
      case 'speed':
        labelText = `Velocidade: ${numValue.toFixed(1)}`;
        break;
      case 'noiseScale':
        labelText = `Suavidade: ${numValue.toFixed(1)}`;
        break;
      case 'waveSize':
        labelText = `Tamanho das Ondas: ${numValue.toFixed(1)}`;
        break;
      case 'waveDirectionX':
        labelText = `Horizontal: ${numValue.toFixed(1)}`;
        break;
      case 'waveDirectionY':
        labelText = `Vertical: ${numValue.toFixed(1)}`;
        break;
      case 'softness':
        labelText = `Suavidade: ${Math.round(numValue * 100)}%`;
        break;
      case 'turbulence':
        labelText = `Turbulência: ${numValue.toFixed(1)}`;
        break;
    }
    
    if (labelText) {
      // Procurar o label usando um seletor mais específico
      const labelSelector = `label[data-effect-id="${effectId}"][data-property="${property}"]`;
      const labelElement = document.querySelector(labelSelector);
      if (labelElement) {
        labelElement.textContent = labelText;
      }
    }
  }

  updateBrush(id, property, value) {
    const effect = this.activeEffects.find(e => e.id === id);
    if (!effect || !effect.brush) return;
    
    if (property === 'size') {
      effect.brush.size = parseInt(value);
    } else if (property === 'hardness') {
      effect.brush.hardness = parseFloat(value);
    }
    
    // Re-renderizar UI para atualizar os valores mostrados
    this.renderEffectsUI();
  }

  startSettingPoint(id) {
    this.settingPointForEffectId = id;
    this.updateCursor();
    this.showNotification('Clique na imagem para definir o ponto.', 'info');
  }

  startPaint(id) {
    // Se já estamos pintando este mesmo efeito, parar a pintura
    if (this.paintingEffectId === id) {
      this.paintingEffectId = null;
      this.updateCursor();
      this.renderEffectsUI();
      brushToolsManager.close();
      return;
    }
    
    // Definir novo efeito ativo (isso automaticamente cancela qualquer outro)
    this.paintingEffectId = id;
    this.updateCursor();
    
    // Encontrar o efeito e garantir que a máscara esteja inicializada
    const effect = this.activeEffects.find(e => e.id === id);
    if (effect && (effect.type === 'maskSway' || effect.type === 'wave' || effect.type === 'saber')) {
      // Garantir que a máscara seja inicializada
      if (window.renderer && window.renderer.elements && window.renderer.elements.canvas) {
        const w = window.renderer.elements.canvas.width;
        const h = window.renderer.elements.canvas.height;
        
        if (w > 0 && h > 0) {
          window.renderer.ensureEffectMaskCanvas(effect, w, h);
          console.log(`Máscara inicializada para efeito ${effect.type} (${w}x${h})`);
        }
      }
    }
    
    this.renderEffectsUI();
    
    // Abrir painel de brush tools para o novo efeito ativo
    if (effect && effect.brush) {
      brushToolsManager.open(effect);
    } else {
      brushToolsManager.close();
    }
  }

  togglePreview(id, checked) {
    const effect = this.activeEffects.find(e => e.id === id);
    if (effect) effect.showPreview = checked;
  }

  toggleEraser(id) {
    const effect = this.activeEffects.find(e => e.id === id);
    if (effect && effect.brush) {
      effect.brush.erase = !effect.brush.erase;
      this.renderEffectsUI();
    }
  }

  getExclusionBrushErase(exclusionId) {
    const effectId = exclusionId.replace('exclusion_', '');
    const effect = this.activeEffects.find(e => e.id == effectId);
    return effect && effect.exclusionMask ? effect.exclusionMask.brush.erase || false : false;
  }

  toggleAnimation() {
    this.animationEnabled = !this.animationEnabled;
    this.updateAnimationToggleUI();
    
    // Notificar o renderer
    if (window.webglRenderer) {
      if (this.animationEnabled) {
        webglRenderer.startAnimation();
        this.showNotification('Animação ativada', 'success');
      } else {
        webglRenderer.pauseAnimation();
        this.showNotification('Animação pausada - ideal para criar máscaras', 'info');
      }
    }
  }

  updateAnimationToggleUI() {
    if (!this.elements.animationToggle || !this.elements.animationToggleText) return;
    
    const button = this.elements.animationToggle;
    const text = this.elements.animationToggleText;
    
    if (this.animationEnabled) {
      button.className = 'btn btn-success btn-sm';
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-circle me-1" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
          <path d="M6.271 5.055a.5.5 0 0 1 .52.26L11 7.055a.5.5 0 0 1 0 .89L6.791 9.685a.5.5 0 0 1-.791-.39V5.705a.5.5 0 0 1 .271-.65"/>
        </svg>
        <span>ON</span>
      `;
      button.title = 'Pausar Animação (Barra de Espaço)';
    } else {
      button.className = 'btn btn-warning btn-sm';
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-circle me-1" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
          <path d="M5 6.25a1.25 1.25 0 1 1 2.5 0v3.5a1.25 1.25 0 1 1-2.5 0zm3.5 0a1.25 1.25 0 1 1 2.5 0v3.5a1.25 1.25 0 1 1-2.5 0z"/>
        </svg>
        <span>OFF</span>
      `;
      button.title = 'Retomar Animação (Barra de Espaço)';
    }
  }

  getAnimationEnabled() {
    return this.animationEnabled;
  }

  toggleEffectExclusion(id, enabled) {
    const effect = this.activeEffects.find(e => e.id === id);
    if (effect && effect.exclusionMask) {
      effect.exclusionMask.enabled = enabled;
      this.renderEffectsUI();
      
      if (enabled) {
        this.showNotification('Máscara de exclusão ativada para este efeito', 'info');
      } else {
        this.showNotification('Máscara de exclusão desativada', 'info');
      }
    }
  }

  startPaintExclusion(id) {
    const exclusionId = 'exclusion_' + id;
    
    // Se já estamos pintando esta mesma exclusão, parar a pintura
    if (this.paintingEffectId === exclusionId) {
      this.paintingEffectId = null;
      this.updateCursor();
      this.renderEffectsUI();
      brushToolsManager.close();
      return;
    }
    
    // Definir nova exclusão ativa (isso automaticamente cancela qualquer outro)
    this.paintingEffectId = exclusionId;
    this.updateCursor();
    this.renderEffectsUI();
    
    // Abrir painel de brush tools para exclusão
    const effect = this.activeEffects.find(e => e.id === id);
    if (effect && effect.exclusionMask && effect.exclusionMask.enabled) {
      // Criar um objeto temporário para o brush tools
      const exclusionBrush = {
        id: exclusionId,
        type: 'exclusion',
        brush: effect.exclusionMask.brush
      };
      brushToolsManager.open(exclusionBrush);
    } else {
      brushToolsManager.close();
    }
  }

  cancelCurrentAction() {
    this.settingPointForEffectId = null;
    this.paintingEffectId = null;
    this.updateCursor();
    this.renderEffectsUI();
    
    // Fechar painel de brush tools
    brushToolsManager.close();
  }

  updateCursor() {
    const canvas = this.elements.canvas;
    if (!canvas) return;
    
    if (this.settingPointForEffectId !== null) {
      canvas.style.cursor = 'crosshair';
    } else if (this.paintingEffectId !== null) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  renderEffectsUI() {
    console.log('Renderizando UI, efeitos ativos:', this.activeEffects.length);
    
    if (!this.elements.activeEffectsList || !this.elements.noEffectsText) {
      console.error('Elementos DOM não encontrados');
      return;
    }
    
    this.elements.noEffectsText.classList.toggle('d-none', this.activeEffects.length > 0);
    
    let html = '';
    if (this.activeEffects.length > 0) {
      html += '<div class="accordion" id="effectsAccordion">';
    }
    
    this.activeEffects.forEach((effect, idx) => {
      const collapseId = `collapse-${effect.id}`;
      const headingId = `heading-${effect.id}`;
      
      let title = '';
      if (effect.type === 'maskSway') {
        const hasMask = effect.maskCanvas ? ' 🎨' : '';
        const isActive = this.paintingEffectId === effect.id ? ' ✏️' : '';
        title = `Máscara (Cabelo) #${idx + 1}${hasMask}${isActive}`;
      } else if (effect.type === 'wave') {
        const hasMask = effect.maskCanvas ? ' 🎨' : '';
        const isActive = this.paintingEffectId === effect.id ? ' ✏️' : '';
        title = `Ondulação #${idx + 1}${hasMask}${isActive}`;
      } else if (effect.type === 'saber') {
        const hasMask = effect.maskCanvas ? ' 🎨' : '';
        const isActive = this.paintingEffectId === effect.id ? ' ✏️' : '';
        title = `Saber #${idx + 1}${hasMask}${isActive}`;
      } else {
        title = `Respiração #${idx + 1}`;
      }
      
      // Apenas o efeito sendo pintado deve estar expandido, ou o mais recente se nenhum ativo
      const isExpanded = (this.paintingEffectId === effect.id) || 
                        (this.paintingEffectId === `exclusion_${effect.id}`) || 
                        (this.paintingEffectId === null && idx === this.activeEffects.length - 1); // Último adicionado
      
      html += `
        <div class="accordion-item border-secondary mb-2">
          <h2 class="accordion-header" id="${headingId}">
            <button class="accordion-button ${isExpanded ? '' : 'collapsed'}" 
                    type="button" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#${collapseId}" 
                    aria-expanded="${isExpanded}" 
                    aria-controls="${collapseId}">
              ${title}
            </button>
          </h2>
          <div id="${collapseId}" 
               class="accordion-collapse collapse ${isExpanded ? 'show' : ''}" 
               aria-labelledby="${headingId}" 
               data-bs-parent="#effectsAccordion">
            <div class="accordion-body p-2">
              ${this.renderEffectControls(effect)}
            </div>
          </div>
        </div>`;
    });
    
    if (this.activeEffects.length > 0) {
      html += '</div>';
    }
    
    this.elements.activeEffectsList.innerHTML = html;
    
    // Adicionar event listeners para controlar preview baseado no estado do collapse
    this.setupCollapseListeners();
    
    console.log('UI renderizada com sucesso');
  }

  setupCollapseListeners() {
    // Aguardar um momento para o DOM ser atualizado
    setTimeout(() => {
      this.activeEffects.forEach((effect, idx) => {
        const collapseElement = document.getElementById(`collapse-${effect.id}`);
        if (collapseElement) {
          // Remover listeners anteriores se existirem
          collapseElement.removeEventListener('shown.bs.collapse', effect._shownListener);
          collapseElement.removeEventListener('hidden.bs.collapse', effect._hiddenListener);
          
          // Criar novos listeners
          effect._shownListener = () => {
            effect.showPreview = true;
            console.log(`Preview ativado para efeito ${effect.id}`);
          };
          
          effect._hiddenListener = () => {
            effect.showPreview = false;
            console.log(`Preview desativado para efeito ${effect.id}`);
            
            // Fechar painel de pincel se estiver pintando este efeito ou sua exclusão
            if (effectsManager.paintingEffectId === effect.id || 
                effectsManager.paintingEffectId === `exclusion_${effect.id}`) {
              brushToolsManager.close();
            }
          };
          
          // Adicionar os listeners
          collapseElement.addEventListener('shown.bs.collapse', effect._shownListener);
          collapseElement.addEventListener('hidden.bs.collapse', effect._hiddenListener);
          
          // Definir estado inicial baseado na lógica de expansão
          // Apenas o efeito sendo pintado ou o mais recente (se nenhum ativo) deve estar expandido
          const isExpanded = (effectsManager.paintingEffectId === effect.id) || 
                            (effectsManager.paintingEffectId === `exclusion_${effect.id}`) || 
                            (effectsManager.paintingEffectId === null && idx === effectsManager.activeEffects.length - 1);
          effect.showPreview = isExpanded;
        }
      });
    }, 50);
  }

  renderEffectControls(effect) {
    if (effect.type === 'maskSway') {
      return `
        <div class="d-flex gap-2 mb-2">
          <button class="btn ${this.paintingEffectId === effect.id ? 'btn-primary' : 'btn-outline-secondary'} btn-sm flex-fill" 
                  onclick="effectsManager.startPaint(${effect.id})">
            ${this.paintingEffectId === effect.id ? '🎨 Pintando...' : '✏️ Pintar Máscara'}
          </button>
          <button class="btn btn-outline-danger btn-sm" 
                  onclick="effectsManager.removeEffect(${effect.id})">
            🗑️
          </button>
        </div>
        ${this.paintingEffectId === effect.id ? `
        <div class="alert alert-success alert-sm mb-2">
          <small>🎨 Use o painel <strong>Ferramentas de Pincel</strong> para ajustar tamanho e modo</small>
        </div>
        ` : ''}
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="strength">Força: ${Math.round((effect.strength || 0) * 2000)}</label>
          <input type="range" class="form-range" 
                 min="0.002" max="0.020" step="0.001" 
                 value="${effect.strength || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'strength', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="speed">Velocidade: ${(effect.speed || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.1" max="3.0" step="0.1" 
                 value="${effect.speed || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'speed', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="noiseScale">Suavidade: ${(effect.noiseScale || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.3" max="2.0" step="0.1" 
                 value="${effect.noiseScale || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'noiseScale', this.value)">
          <small class="text-muted">Valores menores = ondas mais amplas e suaves</small>
        </div>
        <hr class="my-2">
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="exclusion_${effect.id}" 
                 ${effect.exclusionMask?.enabled ? 'checked' : ''}
                 onchange="effectsManager.toggleEffectExclusion(${effect.id}, this.checked)">
          <label class="form-check-label small" for="exclusion_${effect.id}">
            🚫 Máscara de Exclusão para este efeito
          </label>
        </div>
        ${effect.exclusionMask?.enabled ? `
        <button class="btn ${this.paintingEffectId === 'exclusion_' + effect.id ? 'btn-warning' : 'btn-outline-warning'} btn-sm w-100 mb-2" 
                onclick="effectsManager.startPaintExclusion(${effect.id})">
          ${this.paintingEffectId === 'exclusion_' + effect.id ? '🚫 Pintando Exclusão...' : '🚫 Pintar Exclusão'}
        </button>
        ` : ''}
      `;
    } else if (effect.type === 'wave') {
      return `
        <div class="d-flex gap-2 mb-2">
          <button class="btn ${this.paintingEffectId === effect.id ? 'btn-primary' : 'btn-outline-secondary'} btn-sm flex-fill" 
                  onclick="effectsManager.startPaint(${effect.id})">
            ${this.paintingEffectId === effect.id ? '� Pintando...' : '✏️ Pintar Área'}
          </button>
          <button class="btn btn-outline-danger btn-sm" 
                  onclick="effectsManager.removeEffect(${effect.id})">
            🗑️
          </button>
        </div>
        ${this.paintingEffectId === effect.id ? `
        <div class="alert alert-success alert-sm mb-2">
          <small>🎨 Use o painel <strong>Ferramentas de Pincel</strong> para ajustar tamanho e modo</small>
        </div>
        ` : ''}
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="strength">Intensidade: ${Math.round((effect.strength || 0) * 1000)/10}</label>
          <input type="range" class="form-range" 
                 min="0.005" max="0.050" step="0.001" 
                 value="${effect.strength || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'strength', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="speed">Velocidade: ${(effect.speed || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.1" max="5.0" step="0.1" 
                 value="${effect.speed || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'speed', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="waveSize">Tamanho das Ondas: ${(effect.waveSize || 15).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="5.0" max="50.0" step="1.0" 
                 value="${effect.waveSize || 15}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'waveSize', this.value)">
          <small class="text-muted">Valores menores = ondas maiores</small>
        </div>
        <hr class="my-2">
        <div class="mb-2">
          <label class="form-label small">Direção das Ondas</label>
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label small" data-effect-id="${effect.id}" data-property="waveDirectionX">Horizontal: ${(effect.waveDirection?.x || 1).toFixed(1)}</label>
              <input type="range" class="form-range" 
                     min="-1.0" max="1.0" step="0.1" 
                     value="${effect.waveDirection?.x || 1}" 
                     oninput="effectsManager.updateEffect(${effect.id}, 'waveDirectionX', this.value)">
            </div>
            <div class="col-6">
              <label class="form-label small" data-effect-id="${effect.id}" data-property="waveDirectionY">Vertical: ${(effect.waveDirection?.y || 0).toFixed(1)}</label>
              <input type="range" class="form-range" 
                     min="-1.0" max="1.0" step="0.1" 
                     value="${effect.waveDirection?.y || 0}" 
                     oninput="effectsManager.updateEffect(${effect.id}, 'waveDirectionY', this.value)">
            </div>
          </div>
          <small class="text-muted">Ajuste para controlar a direção das ondas</small>
        </div>
        <hr class="my-2">
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="exclusion_${effect.id}" 
                 ${effect.exclusionMask?.enabled ? 'checked' : ''}
                 onchange="effectsManager.toggleEffectExclusion(${effect.id}, this.checked)">
          <label class="form-check-label small" for="exclusion_${effect.id}">
            🚫 Máscara de Exclusão para este efeito
          </label>
        </div>
        ${effect.exclusionMask?.enabled ? `
        <button class="btn ${this.paintingEffectId === 'exclusion_' + effect.id ? 'btn-warning' : 'btn-outline-warning'} btn-sm w-100 mb-2" 
                onclick="effectsManager.startPaintExclusion(${effect.id})">
          ${this.paintingEffectId === 'exclusion_' + effect.id ? '🚫 Pintando Exclusão...' : '🚫 Pintar Exclusão'}
        </button>
        ` : ''}
      `;
    } else if (effect.type === 'saber') {
      return `
        <div class="d-flex gap-2 mb-2">
          <button class="btn ${this.paintingEffectId === effect.id ? 'btn-primary' : 'btn-outline-secondary'} btn-sm flex-fill" 
                  onclick="effectsManager.startPaint(${effect.id})">
            ${this.paintingEffectId === effect.id ? '🎨 Pintando...' : '⚔️ Pintar Área'}
          </button>
          <button class="btn btn-outline-danger btn-sm" 
                  onclick="effectsManager.removeEffect(${effect.id})">
            🗑️
          </button>
        </div>
        ${this.paintingEffectId === effect.id ? `
        <div class="alert alert-success alert-sm mb-2">
          <small>🎨 Use o painel <strong>Ferramentas de Pincel</strong> para ajustar tamanho e modo</small>
        </div>
        ` : ''}
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="strength">Intensidade: ${Math.round((effect.strength || 0) * 1250)/10}</label>
          <input type="range" class="form-range" 
                 min="0.002" max="0.100" step="0.002" 
                 value="${effect.strength || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'strength', this.value)">
          <small class="text-muted">Brilho e visibilidade da chama</small>
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="speed">Velocidade: ${(effect.speed || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.1" max="3.0" step="0.1" 
                 value="${effect.speed || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'speed', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="turbulence">Turbulência: ${(effect.turbulence || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.1" max="2.0" step="0.1" 
                 value="${effect.turbulence || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'turbulence', this.value)">
          <small class="text-muted">Controla a agitação da chama</small>
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="fuzziness">Suavização: ${(effect.fuzziness || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.1" max="1.0" step="0.1" 
                 value="${effect.fuzziness || 0.4}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'fuzziness', this.value)">
          <small class="text-muted">Suaviza as bordas da chama</small>
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="baseSize">Largura: ${(effect.baseSize || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.5" max="3.0" step="0.1" 
                 value="${effect.baseSize || 1.2}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'baseSize', this.value)">
          <small class="text-muted">Largura da base da chama</small>
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="verticalFalloff">Falloff Vertical: ${(effect.verticalFalloff || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="1.0" max="5.0" step="0.1" 
                 value="${effect.verticalFalloff || 2.0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'verticalFalloff', this.value)">
          <small class="text-muted">Como a chama diminui verticalmente</small>
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="pulseIntensity">Pulsação de Cor: ${(effect.pulseIntensity || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.0" max="3.0" step="0.1" 
                 value="${effect.pulseIntensity || 1.0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'pulseIntensity', this.value)">
          <small class="text-muted">Intensidade da pulsação e brilho da cor</small>
        </div>
        <hr class="my-2">
        <div class="mb-2">
          <label class="form-label small">Presets de Chama</label>
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-outline-primary btn-sm" 
                    onclick="effectsManager.applySaberPreset(${effect.id}, 'torchlight')">
              🔥 Tocha
            </button>
            <button class="btn btn-outline-secondary btn-sm" 
                    onclick="effectsManager.applySaberPreset(${effect.id}, 'bonfire')">
              🔥 Fogueira
            </button>
            <button class="btn btn-outline-info btn-sm" 
                    onclick="effectsManager.applySaberPreset(${effect.id}, 'magic')">
              ✨ Magia
            </button>
            <button class="btn btn-outline-warning btn-sm" 
                    onclick="effectsManager.applySaberPreset(${effect.id}, 'candle')">
              🕯️ Vela
            </button>
          </div>
          <small class="text-muted">Estilos pré-configurados de chama</small>
        </div>
        <hr class="my-2">
        <div class="mb-2">
          <label class="form-label small">Cor da Luz</label>
          <div class="d-flex gap-2 align-items-center">
            <input type="color" class="form-control form-control-color" 
                   value="${effect.color || '#ff6b35'}" 
                   style="width: 50px; height: 35px;"
                   onchange="effectsManager.updateEffect(${effect.id}, 'color', this.value)">
            <small class="text-muted flex-grow-1">Escolha a cor da névoa luminosa</small>
          </div>
        </div>
        <hr class="my-2">
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="exclusion_${effect.id}" 
                 ${effect.exclusionMask?.enabled ? 'checked' : ''}
                 onchange="effectsManager.toggleEffectExclusion(${effect.id}, this.checked)">
          <label class="form-check-label small" for="exclusion_${effect.id}">
            🚫 Máscara de Exclusão para este efeito
          </label>
        </div>
        ${effect.exclusionMask?.enabled ? `
        <button class="btn ${this.paintingEffectId === 'exclusion_' + effect.id ? 'btn-warning' : 'btn-outline-warning'} btn-sm w-100 mb-2" 
                onclick="effectsManager.startPaintExclusion(${effect.id})">
          ${this.paintingEffectId === 'exclusion_' + effect.id ? '🚫 Pintando Exclusão...' : '🚫 Pintar Exclusão'}
        </button>
        ` : ''}
      `;
    } else {
      return `
        <div class="d-flex gap-2 mb-2">
          <button class="btn ${this.settingPointForEffectId === effect.id ? 'btn-primary' : 'btn-outline-secondary'} btn-sm flex-fill" 
                  onclick="effectsManager.startSettingPoint(${effect.id})">
            ${this.settingPointForEffectId === effect.id ? '🎯 Definindo...' : '📍 Definir Ponto'}
          </button>
          <button class="btn btn-outline-danger btn-sm" 
                  onclick="effectsManager.removeEffect(${effect.id})">
            🗑️
          </button>
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="strength">Intensidade: ${Math.round((effect.strength || 0) * 5000)/10}</label>
          <input type="range" class="form-range" 
                 min="0.002" max="0.025" step="0.001" 
                 value="${effect.strength || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'strength', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="radius">Raio: ${Math.round((effect.radius || 0) * 100)}%</label>
          <input type="range" class="form-range" 
                 min="0.1" max="1.0" step="0.01" 
                 value="${effect.radius || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'radius', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label small" data-effect-id="${effect.id}" data-property="speed">Velocidade: ${(effect.speed || 0).toFixed(1)}</label>
          <input type="range" class="form-range" 
                 min="0.5" max="5.0" step="0.1" 
                 value="${effect.speed || 0}" 
                 oninput="effectsManager.updateEffect(${effect.id}, 'speed', this.value)">
          <small class="text-muted">Controla a velocidade da respiração</small>
        </div>
        <hr class="my-2">
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="exclusion_${effect.id}" 
                 ${effect.exclusionMask?.enabled ? 'checked' : ''}
                 onchange="effectsManager.toggleEffectExclusion(${effect.id}, this.checked)">
          <label class="form-check-label small" for="exclusion_${effect.id}">
            🚫 Máscara de Exclusão para este efeito
          </label>
        </div>
        ${effect.exclusionMask?.enabled ? `
        <button class="btn ${this.paintingEffectId === 'exclusion_' + effect.id ? 'btn-warning' : 'btn-outline-warning'} btn-sm w-100 mb-2" 
                onclick="effectsManager.startPaintExclusion(${effect.id})">
          ${this.paintingEffectId === 'exclusion_' + effect.id ? '🚫 Pintando Exclusão...' : '🚫 Pintar Exclusão'}
        </button>
        ` : ''}
      `;
    }
  }

  reset() {
    // Limpar listeners de collapse antes de resetar
    this.activeEffects.forEach(effect => {
      if (effect._shownListener || effect._hiddenListener) {
        const collapseElement = document.getElementById(`collapse-${effect.id}`);
        if (collapseElement) {
          collapseElement.removeEventListener('shown.bs.collapse', effect._shownListener);
          collapseElement.removeEventListener('hidden.bs.collapse', effect._hiddenListener);
        }
      }
    });
    
    this.activeEffects = [];
    this.settingPointForEffectId = null;
    this.paintingEffectId = null;
    this.updateCursor();
    this.renderEffectsUI();
  }

  showNotification(message, type = 'info') {
    console.log('Notificação:', message);
    
    // Criar notificação simples
    const toastContainer = this.getOrCreateToastContainer();
    const toast = this.createToast(message, type);
    
    toastContainer.appendChild(toast);
    
    // Inicializar Bootstrap toast se disponível
    if (typeof bootstrap !== 'undefined') {
      const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
      });
      bsToast.show();
    }
    
    // Remover após delay
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3500);
  }

  getOrCreateToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed top-0 end-0 p-3';
      container.style.zIndex = '1055';
      document.body.appendChild(container);
    }
    return container;
  }

  createToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center border-0';
    toast.setAttribute('role', 'alert');
    
    let bgClass = 'bg-primary';
    switch (type) {
      case 'success':
        bgClass = 'bg-success';
        break;
      case 'warning':
        bgClass = 'bg-warning text-dark';
        break;
      case 'error':
        bgClass = 'bg-danger';
        break;
    }
    
    toast.className += ` ${bgClass} text-white`;
    
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
      </div>
    `;
    
    return toast;
  }
}

// Criar instância global
const effectsManager = new EffectsManager();

// Gerenciador de ferramentas de pincel
class BrushToolsManager {
  constructor() {
    this.isOpen = false;
    this.currentEffect = null;
    
    this.elements = {
      panel: document.getElementById('brushToolsPanel'),
      preview: document.getElementById('brushPreview'),
      sizeSlider: document.getElementById('brushSize'),
      hardnessSlider: document.getElementById('brushHardness'),
      sizeDisplay: document.getElementById('brushSizeDisplay'),
      hardnessDisplay: document.getElementById('brushHardnessDisplay'),
      brushModeBtn: document.getElementById('brushModeBtn'),
      eraserModeBtn: document.getElementById('eraserModeBtn'),
      clearBtn: document.getElementById('clearCurrentMask'),
      closeBtn: document.getElementById('closeBrushTools')
    };
    
    this.initializeEventListeners();
    this.setupPreviewCanvas();
  }

  initializeEventListeners() {
    // Controles de tamanho e dureza
    if (this.elements.sizeSlider) {
      this.elements.sizeSlider.addEventListener('input', (e) => {
        this.updateBrushSize(parseInt(e.target.value));
      });
    }

    if (this.elements.hardnessSlider) {
      this.elements.hardnessSlider.addEventListener('input', (e) => {
        this.updateBrushHardness(parseFloat(e.target.value));
      });
    }

    // Botões de modo
    if (this.elements.brushModeBtn) {
      this.elements.brushModeBtn.addEventListener('click', () => {
        this.setBrushMode(false); // paint mode
      });
    }

    if (this.elements.eraserModeBtn) {
      this.elements.eraserModeBtn.addEventListener('click', () => {
        this.setBrushMode(true); // erase mode
      });
    }

    // Botão de limpar
    if (this.elements.clearBtn) {
      this.elements.clearBtn.addEventListener('click', () => {
        this.clearCurrentMask();
      });
    }

    // Botão de fechar
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }

  setupPreviewCanvas() {
    if (!this.elements.preview) return;
    
    const canvas = this.elements.preview;
    const ctx = canvas.getContext('2d');
    
    // Limpar canvas
    ctx.fillStyle = '#2d3236';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    this.updatePreview();
  }

  updatePreview() {
    if (!this.elements.preview || !this.currentEffect) return;
    
    const canvas = this.elements.preview;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Limpar
    ctx.fillStyle = '#2d3236';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let brush;
    
    // Para efeitos de exclusão, usar o brush correto
    if (this.currentEffect.type === 'exclusion') {
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const originalEffect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (originalEffect && originalEffect.exclusionMask) {
        brush = originalEffect.exclusionMask.brush;
      } else {
        return;
      }
    } else {
      brush = this.currentEffect.brush;
    }
    
    if (!brush) return;
    
    const size = Math.min(brush.size || 20, 40); // Limitar tamanho no preview
    const hardness = brush.hardness || 1.0;
    const isEraser = brush.erase || false;
    
    // Criar gradiente radial
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, size
    );
    
    const alpha = isEraser ? 0.3 : 0.8;
    const color = isEraser ? '#ffc107' : '#ffffff';
    
    gradient.addColorStop(0, `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(hardness, `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, `${color}00`);
    
    // Desenhar círculo do pincel
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Desenhar borda
    ctx.strokeStyle = isEraser ? '#fd7e14' : '#6c757d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
    ctx.stroke();
    
    // Desenhar círculo interno (área da dureza)
    if (hardness < 1.0) {
      ctx.strokeStyle = isEraser ? '#fd7e14' : '#6c757d';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, size * hardness, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
    
    // Centro
    ctx.fillStyle = isEraser ? '#fd7e14' : '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  open(effect) {
    if (!effect || !effect.brush) return;
    
    this.currentEffect = effect;
    this.isOpen = true;
    
    // Mostrar painel
    if (this.elements.panel) {
      this.elements.panel.classList.remove('d-none');
    }
    
    // Sincronizar controles com o efeito
    this.syncControls();
    this.updatePreview();
  }

  close() {
    this.isOpen = false;
    this.currentEffect = null;
    
    // Desativar pintura
    effectsManager.paintingEffectId = null;
    
    // Limpar cursor do pincel
    webglRenderer.cursorImgX = null;
    webglRenderer.cursorImgY = null;
    
    // Ocultar painel
    if (this.elements.panel) {
      this.elements.panel.classList.add('d-none');
    }
  }

  syncControls() {
    if (!this.currentEffect) return;
    
    let brush;
    
    // Para efeitos de exclusão, usar o brush correto
    if (this.currentEffect.type === 'exclusion') {
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const originalEffect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (originalEffect && originalEffect.exclusionMask) {
        brush = originalEffect.exclusionMask.brush;
      } else {
        return; // Não conseguiu encontrar o brush correto
      }
    } else {
      if (!this.currentEffect.brush) return;
      brush = this.currentEffect.brush;
    }
    
    // Sincronizar sliders
    if (this.elements.sizeSlider) {
      this.elements.sizeSlider.value = brush.size || 20;
    }
    
    if (this.elements.hardnessSlider) {
      this.elements.hardnessSlider.value = brush.hardness || 1.0;
    }
    
    // Atualizar displays
    this.updateDisplays();
    
    // Atualizar botões de modo
    this.updateModeButtons();
  }

  updateDisplays() {
    if (!this.currentEffect) return;
    
    let brush;
    
    // Para efeitos de exclusão, usar o brush correto
    if (this.currentEffect.type === 'exclusion') {
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const originalEffect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (originalEffect && originalEffect.exclusionMask) {
        brush = originalEffect.exclusionMask.brush;
      } else {
        return;
      }
    } else {
      brush = this.currentEffect.brush;
    }
    
    if (!brush) return;
    
    if (this.elements.sizeDisplay) {
      this.elements.sizeDisplay.textContent = `${brush.size || 20}px`;
    }
    
    if (this.elements.hardnessDisplay) {
      this.elements.hardnessDisplay.textContent = `${Math.round((brush.hardness || 1.0) * 100)}%`;
    }
  }

  updateModeButtons() {
    if (!this.currentEffect) return;
    
    let isEraser = false;
    
    // Para efeitos de exclusão, ler do brush correto
    if (this.currentEffect.type === 'exclusion') {
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const originalEffect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (originalEffect && originalEffect.exclusionMask) {
        isEraser = originalEffect.exclusionMask.brush.erase || false;
      }
    } else {
      isEraser = this.currentEffect.brush.erase || false;
    }
    
    // Atualizar classes dos botões
    if (this.elements.brushModeBtn) {
      this.elements.brushModeBtn.classList.toggle('active', !isEraser);
    }
    
    if (this.elements.eraserModeBtn) {
      this.elements.eraserModeBtn.classList.toggle('active', isEraser);
    }
  }

  updateBrushSize(size) {
    if (!this.currentEffect) return;
    
    // Para efeitos de exclusão, modificar o brush correto
    if (this.currentEffect.type === 'exclusion') {
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const originalEffect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (originalEffect && originalEffect.exclusionMask) {
        originalEffect.exclusionMask.brush.size = size;
      }
    } else {
      this.currentEffect.brush.size = size;
    }
    
    this.updateDisplays();
    this.updatePreview();
    
    // Atualizar o efeito no EffectsManager
    effectsManager.renderEffectsUI();
  }

  updateBrushHardness(hardness) {
    if (!this.currentEffect) return;
    
    // Para efeitos de exclusão, modificar o brush correto
    if (this.currentEffect.type === 'exclusion') {
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const originalEffect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (originalEffect && originalEffect.exclusionMask) {
        originalEffect.exclusionMask.brush.hardness = hardness;
      }
    } else {
      this.currentEffect.brush.hardness = hardness;
    }
    
    this.updateDisplays();
    this.updatePreview();
    
    // Atualizar o efeito no EffectsManager
    effectsManager.renderEffectsUI();
  }

  setBrushMode(isEraser) {
    if (!this.currentEffect) return;
    
    // Para efeitos de exclusão, modificar o brush correto
    if (this.currentEffect.type === 'exclusion') {
      // É uma máscara de exclusão - encontrar o efeito original
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const originalEffect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (originalEffect && originalEffect.exclusionMask) {
        originalEffect.exclusionMask.brush.erase = isEraser;
      }
    } else {
      // É um efeito normal
      this.currentEffect.brush.erase = isEraser;
    }
    
    this.updateModeButtons();
    this.updatePreview();
    
    // Atualizar o efeito no EffectsManager
    effectsManager.renderEffectsUI();
  }

  clearCurrentMask() {
    if (!this.currentEffect) return;
    
    if (this.currentEffect.type === 'exclusion') {
      // É uma máscara de exclusão individual
      const effectId = this.currentEffect.id.replace('exclusion_', '');
      const effect = effectsManager.activeEffects.find(e => e.id == effectId);
      if (effect && effect.exclusionMask) {
        // Limpar canvas específico da exclusão deste efeito
        // Por ora, usar o sistema global mas isso será melhorado
        webglRenderer.clearExclusionMask();
      }
    } else {
      // Limpar máscara individual do efeito
      const effect = effectsManager.activeEffects.find(e => e.id == this.currentEffect.id);
      if (effect) {
        webglRenderer.clearEffectMask(effect);
      }
    }
  }

  // Aplicar presets de saber baseados no código Three.js
  applySaberPreset(id, presetName) {
    const effect = this.activeEffects.find(e => e.id === id);
    if (!effect || effect.type !== 'saber') return;

    const presets = {
      torchlight: {
        strength: 0.030,    // Reduzir de 0.050
        speed: 1.67,
        turbulence: 1.2,
        fuzziness: 0.07,
        baseSize: 2.4,
        verticalFalloff: 1.7,
        pulseIntensity: 1.2,  // Reduzir de 1.5
        color: '#bb1c2f'
      },
      bonfire: {
        strength: 0.025,    // Reduzir de 0.035
        speed: 0.61,
        turbulence: 0.6,
        fuzziness: 0.27,
        baseSize: 2.5,
        verticalFalloff: 2.0,
        pulseIntensity: 0.6,  // Reduzir de 0.8
        color: '#9b1111'
      },
      magic: {
        strength: 0.035,    // Reduzir de 0.055
        speed: 1.13,
        turbulence: 1.2,
        fuzziness: 0.45,
        baseSize: 2.3,
        verticalFalloff: 2.4,
        pulseIntensity: 2.0,  // Reduzir de 2.5
        color: '#662d78'
      },
      candle: {
        strength: 0.045,    // Reduzir de 0.070
        speed: 1.84,
        turbulence: 1.8,
        fuzziness: 1.0,
        baseSize: 2.8,
        verticalFalloff: 2.5,
        pulseIntensity: 2.5,  // Reduzir de 3.0
        color: '#a84f42'
      }
    };

    const preset = presets[presetName];
    if (!preset) return;

    // Aplicar todos os valores do preset
    Object.keys(preset).forEach(key => {
      effect[key] = preset[key];
    });

    // Rerrenderizar UI para mostrar novos valores
    this.renderEffectsUI();
    
    this.showNotification(`Preset "${presetName}" aplicado ao saber!`, 'success');
  }
}

// Criar instância global
const brushToolsManager = new BrushToolsManager();
// Renderizador WebGL
const MAX_EFFECTS = 50;

class WebGLRenderer {
  constructor() {
    this.gl = null;
    this.shaderProgram = null;
    this.texture = null;
    this.uniforms = {};
    this.animationFrameId = null;
    
    // Máscara de cabelo
    this.maskCanvas = null;
    this.maskCtx = null;
    this.maskTexture = null;
    
    // Máscara de exclusão
    this.exclusionMaskCanvas = null;
    this.exclusionMaskCtx = null;
    this.exclusionMaskTexture = null;
    
    // Cursor de pintura
    this.cursorImgX = null;
    this.cursorImgY = null;
    
    // Pintura
    this.painting = false;
    this.paintTimer = null;
    
    this.elements = {
      canvas: document.getElementById('canvas'),
      overlay: document.getElementById('overlay')
    };
    
    this.initializeEvents();
  }

  initializeEvents() {
    // Canvas events
    this.elements.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.elements.canvas.addEventListener('pointerdown', (e) => this.onPointerDownPaint(e));
    this.elements.canvas.addEventListener('pointermove', (e) => this.onPointerMovePaint(e));
    window.addEventListener('pointerup', (e) => this.onPointerUpPaint(e));

    this.elements.canvas.addEventListener('mousemove', (e) => {
      if (!window.userImage) return;
      const r = this.elements.canvas.getBoundingClientRect();
      this.cursorImgX = (e.clientX - r.left) / r.width * this.elements.canvas.width;
      this.cursorImgY = (e.clientY - r.top) / r.height * this.elements.canvas.height;
    });
  }

  initWebGL() {
    this.gl = this.elements.canvas.getContext('webgl', { 
      preserveDrawingBuffer: true, 
      alpha: true 
    });
    
    if (!this.gl) {
      effectsManager.showNotification('Seu navegador não suporta WebGL.', 'error');
      return false;
    }

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    const vertexShader = this.createShader(this.gl, this.gl.VERTEX_SHADER, Shaders.vertex);
    const fragmentShader = this.createShader(this.gl, this.gl.FRAGMENT_SHADER, Shaders.fragment);
    
    this.shaderProgram = this.createProgram(this.gl, vertexShader, fragmentShader);
    this.gl.useProgram(this.shaderProgram);

    // Get uniform locations
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.shaderProgram, 'u_resolution'),
      image: this.gl.getUniformLocation(this.shaderProgram, 'u_image'),
      time: this.gl.getUniformLocation(this.shaderProgram, 'u_time'),
      effect_count: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_count'),
      effect_types: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_types'),
      effect_markers: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_markers'),
      effect_strengths: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_strengths'),
      effect_radii: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_radii'),
      effect_softnesses: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_softnesses'),
      effect_speeds: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_speeds'),
      effect_phases: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_phases'),
      paramsA: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_paramsA'),
      paramsB: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_paramsB'),
      colors: this.gl.getUniformLocation(this.shaderProgram, 'u_effect_colors'),
      mask: this.gl.getUniformLocation(this.shaderProgram, 'u_mask'),
      mask2: this.gl.getUniformLocation(this.shaderProgram, 'u_mask2'),
      mask3: this.gl.getUniformLocation(this.shaderProgram, 'u_mask3'),
      exclusion_mask: this.gl.getUniformLocation(this.shaderProgram, 'u_exclusion_mask'),
      maskRes: this.gl.getUniformLocation(this.shaderProgram, 'u_mask_resolution')
    };

    // Setup geometry
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER, 
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), 
      this.gl.STATIC_DRAW
    );

    const posAttrLoc = this.gl.getAttribLocation(this.shaderProgram, 'a_position');
    this.gl.enableVertexAttribArray(posAttrLoc);
    this.gl.vertexAttribPointer(posAttrLoc, 2, this.gl.FLOAT, false, 0, 0);

    return true;
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    
    return program;
  }

  createTexture(image) {
    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
  }

  // Mask management
  ensureMaskCanvas(w, h) {
    if (this.maskCanvas && this.maskCanvas.width === w && this.maskCanvas.height === h) return;
    
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = w;
    this.maskCanvas.height = h;
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.maskCtx.clearRect(0, 0, w, h);
    this.uploadMaskTexture();
  }

  ensureExclusionMaskCanvas(w, h) {
    if (this.exclusionMaskCanvas && this.exclusionMaskCanvas.width === w && this.exclusionMaskCanvas.height === h) return;
    
    this.exclusionMaskCanvas = document.createElement('canvas');
    this.exclusionMaskCanvas.width = w;
    this.exclusionMaskCanvas.height = h;
    this.exclusionMaskCtx = this.exclusionMaskCanvas.getContext('2d');
    this.exclusionMaskCtx.clearRect(0, 0, w, h);
    this.uploadExclusionMaskTexture();
  }

  uploadMaskTexture() {
    if (!this.gl || !this.maskCanvas) return;
    
    if (!this.maskTexture) {
      this.maskTexture = this.gl.createTexture();
    }
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.maskTexture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.maskCanvas);
  }

  uploadExclusionMaskTexture() {
    if (!this.gl || !this.exclusionMaskCanvas) return;
    
    if (!this.exclusionMaskTexture) {
      this.exclusionMaskTexture = this.gl.createTexture();
    }
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.exclusionMaskTexture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.exclusionMaskCanvas);
  }

  clearMask() {
    if (!this.maskCtx || !this.maskCanvas) return;
    
    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    this.uploadMaskTexture();
    effectsManager.showNotification('Máscara limpa!', 'info');
  }

  clearExclusionMask() {
    if (!this.exclusionMaskCtx || !this.exclusionMaskCanvas) return;
    
    this.exclusionMaskCtx.clearRect(0, 0, this.exclusionMaskCanvas.width, this.exclusionMaskCanvas.height);
    this.uploadExclusionMaskTexture();
    effectsManager.showNotification('Máscara de exclusão limpa!', 'info');
  }

  // Mask refinement functions
  blurMask(px = 1) {
    if (!this.maskCanvas) return;
    
    const tmp = document.createElement('canvas');
    tmp.width = this.maskCanvas.width;
    tmp.height = this.maskCanvas.height;
    const tctx = tmp.getContext('2d');
    tctx.filter = `blur(${px}px)`;
    tctx.drawImage(this.maskCanvas, 0, 0);
    
    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    this.maskCtx.drawImage(tmp, 0, 0);
    this.uploadMaskTexture();
    effectsManager.showNotification(`Máscara suavizada ${px}px`, 'success');
  }

  morphMask(type = 'dilate', iters = 1) {
    if (!this.maskCanvas) return;
    
    const w = this.maskCanvas.width;
    const h = this.maskCanvas.height;
    let src = this.maskCtx.getImageData(0, 0, w, h);
    let dst = this.maskCtx.createImageData(w, h);
    
    const N = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1];
    
    for (let n = 0; n < iters; n++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const a = src.data[i + 3];
          
          if (type === 'dilate') {
            let maxA = a;
            for (let k = 0; k < 16; k += 2) {
              const nx = x + N[k];
              const ny = y + N[k + 1];
              if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
                const j = (ny * w + nx) * 4;
                maxA = Math.max(maxA, src.data[j + 3]);
              }
            }
            dst.data[i] = 255;
            dst.data[i + 1] = 255;
            dst.data[i + 2] = 255;
            dst.data[i + 3] = maxA;
          } else { // erode
            let minA = a;
            for (let k = 0; k < 16; k += 2) {
              const nx = x + N[k];
              const ny = y + N[k + 1];
              if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
                const j = (ny * w + nx) * 4;
                minA = Math.min(minA, src.data[j + 3]);
              }
            }
            dst.data[i] = 255;
            dst.data[i + 1] = 255;
            dst.data[i + 2] = 255;
            dst.data[i + 3] = minA;
          }
        }
      }
      src = dst;
      dst = this.maskCtx.createImageData(w, h);
    }
    
    this.maskCtx.putImageData(src, 0, 0);
    this.uploadMaskTexture();
    effectsManager.showNotification(`Máscara ${type === 'dilate' ? 'expandida' : 'contraída'}!`, 'success');
  }

  // Painting functionality
  handleCanvasClick(e) {
    if (!window.userImage) return;
    if (effectsManager.settingPointForEffectId === null) return;

    const rect = this.elements.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - ((e.clientY - rect.top) / rect.height);

    const effect = effectsManager.activeEffects.find(ef => ef.id === effectsManager.settingPointForEffectId);
    if (effect) {
      effect.marker = { x, y };
      effectsManager.settingPointForEffectId = null;
      effectsManager.updateCursor();
      effectsManager.showNotification('Ponto definido!', 'success');
    }
  }

  onPointerDownPaint(ev) {
    if (!window.userImage || effectsManager.paintingEffectId === null) return;
    this.painting = true;
    this.paintAtEvent(ev);
  }

  onPointerMovePaint(ev) {
    if (!window.userImage) return;
    if (this.painting && effectsManager.paintingEffectId !== null) {
      this.paintAtEvent(ev);
    }
  }

  onPointerUpPaint() {
    if (!window.userImage) return;
    if (this.painting) {
      this.painting = false;
      this.uploadMaskTexture();
    }
  }

  paintAtEvent(e) {
    if (!window.userImage) return;
    
    const rect = this.elements.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * this.elements.canvas.width;
    const y = (e.clientY - rect.top) / rect.height * this.elements.canvas.height;
    
    // Encontrar o efeito sendo pintado
    let effectId = effectsManager.paintingEffectId;
    let isExclusion = false;
    
    // Verificar se é uma exclusão individual
    if (typeof effectId === 'string' && effectId.startsWith('exclusion_')) {
      isExclusion = true;
      effectId = effectId.replace('exclusion_', '');
    }
    
    const eff = effectsManager.activeEffects.find(ef => ef.id == effectId);
    if (!eff) return;

    // Selecionar canvas e contexto baseado no tipo de máscara
    let ctx, canvas;
    if (isExclusion) {
      this.ensureExclusionMaskCanvas(this.elements.canvas.width, this.elements.canvas.height);
      ctx = this.exclusionMaskCtx;
      canvas = this.exclusionMaskCanvas;
    } else {
      // Usar o canvas individual do efeito para máscaras normais
      this.ensureEffectMaskCanvas(eff, this.elements.canvas.width, this.elements.canvas.height);
      ctx = eff.maskCtx;
      canvas = eff.maskCanvas;
    }

    if (!ctx) return;

    // Selecionar o brush correto
    let brush = eff.brush;
    if (isExclusion && eff.exclusionMask) {
      brush = eff.exclusionMask.brush;
    }

    let r = brush.size;
    if (brush.pressure && e.pressure && e.pointerType !== 'mouse') {
      r = Math.max(1, brush.size * (0.2 + 0.8 * e.pressure));
    }

    const hardness = Math.max(0.01, Math.min(1.0, brush.hardness));
    
    if (brush.erase) {
      // Modo borracha - usar destination-out para apagar
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#ffffff'; // Cor não importa no destination-out
      ctx.globalAlpha = 1.0; // Alpha completo para apagar completamente
      ctx.beginPath();
      ctx.arc(x, y, r, 0, effectsManager.TWO_PI);
      ctx.fill();
    } else {
      // Modo pincel normal - criar gradiente
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,1.0)`);
      grd.addColorStop(hardness, `rgba(255,255,255,1.0)`);
      grd.addColorStop(1, `rgba(255,255,255,0.0)`);
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = grd;
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, effectsManager.TWO_PI);
      ctx.fill();
    }
    
    // Restaurar configurações padrão do contexto
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    clearTimeout(this.paintTimer);
    this.paintTimer = setTimeout(() => {
      if (isExclusion) {
        this.uploadExclusionMaskTexture();
      } else {
        this.uploadEffectMaskTexture(eff);
      }
    }, 30);
  }

  // Rendering
  drawOverlay() {
    if (!window.userImage) return;
    
    const ctx = this.elements.overlay.getContext('2d');
    ctx.clearRect(0, 0, this.elements.overlay.width, this.elements.overlay.height);
    ctx.save();

    // Preview: círculos da respiração
    effectsManager.activeEffects.forEach((e) => {
      if (!e.showPreview) return;
      
      if (e.type === 'breathing') {
        const cx = e.marker.x * this.elements.overlay.width;
        const cy = (1.0 - e.marker.y) * this.elements.overlay.height;
        const r = e.radius * Math.min(this.elements.overlay.width, this.elements.overlay.height);
        
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#0d6efd';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, effectsManager.TWO_PI);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0d6efd';
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, effectsManager.TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Preview: máscara ativa sendo editada (apenas uma por vez para evitar duplicação)
    if (effectsManager.paintingEffectId !== null && !String(effectsManager.paintingEffectId).startsWith('exclusion_')) {
      // Encontrar o efeito sendo pintado
      const activeEffect = effectsManager.activeEffects.find(e => e.id == effectsManager.paintingEffectId && e.type === 'maskSway');
      if (activeEffect && activeEffect.maskCanvas) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#00ff44'; // Verde para máscara ativa
        ctx.globalCompositeOperation = 'source-over';
        
        // Criar uma versão colorida da máscara individual
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = activeEffect.maskCanvas.width;
        tempCanvas.height = activeEffect.maskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Desenhar a máscara com a cor específica
        tempCtx.fillStyle = '#00ff44';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(activeEffect.maskCanvas, 0, 0);
        
        ctx.drawImage(tempCanvas, 0, 0, this.elements.overlay.width, this.elements.overlay.height);
      }
    } else if (effectsManager.paintingEffectId === null) {
      // Se não há efeito ativo, mostrar preview de efeitos expandidos (mas sem duplicar)
      const previewEffect = effectsManager.activeEffects.find(e => (e.type === 'maskSway' || e.type === 'wave' || e.type === 'saber') && e.showPreview && e.maskCanvas);
      if (previewEffect) {
        ctx.globalAlpha = 0.25; // Mais transparente para preview passivo
        ctx.fillStyle = '#ffffff';
        ctx.globalCompositeOperation = 'source-over';
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = previewEffect.maskCanvas.width;
        tempCanvas.height = previewEffect.maskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(previewEffect.maskCanvas, 0, 0);
        
        ctx.drawImage(tempCanvas, 0, 0, this.elements.overlay.width, this.elements.overlay.height);
      }
    }

    // Preview: máscara de exclusão ativa sendo editada
    if (effectsManager.paintingEffectId !== null && String(effectsManager.paintingEffectId).startsWith('exclusion_')) {
      // Mostrar preview da máscara de exclusão em vermelho semi-transparente apenas quando está sendo editada
      if (this.exclusionMaskCanvas) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ff4444';
        ctx.globalCompositeOperation = 'source-over';
        
        // Criar uma versão colorida da máscara de exclusão
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.exclusionMaskCanvas.width;
        tempCanvas.height = this.exclusionMaskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Desenhar a máscara como uma forma vermelha
        tempCtx.fillStyle = '#ff4444';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(this.exclusionMaskCanvas, 0, 0);
        
        ctx.drawImage(tempCanvas, 0, 0, this.elements.overlay.width, this.elements.overlay.height);
      }
    }

    // Preview: máscara normal quando o pincel estiver ativo (não exclusão)
    if (effectsManager.paintingEffectId !== null && 
        !String(effectsManager.paintingEffectId).startsWith('exclusion_')) {
      
      const paintingEff = effectsManager.activeEffects.find(e => e.id == effectsManager.paintingEffectId);
      if (paintingEff && (paintingEff.type === 'maskSway' || paintingEff.type === 'wave' || paintingEff.type === 'saber') && paintingEff.maskCanvas) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#00ff44';
        ctx.globalCompositeOperation = 'source-over';
        
        // Criar uma versão colorida da máscara individual
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = paintingEff.maskCanvas.width;
        tempCanvas.height = paintingEff.maskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Desenhar a máscara como uma forma verde
        tempCtx.fillStyle = '#00ff44';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(paintingEff.maskCanvas, 0, 0);
        
        ctx.drawImage(tempCanvas, 0, 0, this.elements.overlay.width, this.elements.overlay.height);
      }
    }

    // Restaurar configurações do contexto
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    // Cursor do pincel
    if (effectsManager.paintingEffectId !== null && this.cursorImgX !== null) {
      let effectId = effectsManager.paintingEffectId;
      let isExclusion = false;
      
      // Verificar se é uma exclusão individual
      if (typeof effectId === 'string' && effectId.startsWith('exclusion_')) {
        isExclusion = true;
        effectId = effectId.replace('exclusion_', '');
      }
      
      const e = effectsManager.activeEffects.find(x => x.id == effectId);
      if (e) {
        let brush = e.brush;
        
        // Se for exclusão, usar o brush da exclusionMask
        if (isExclusion && e.exclusionMask) {
          brush = e.exclusionMask.brush;
        }
        
        const r = brush.size;
        const innerR = r * (brush.hardness || 1.0);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        
        // Cor diferente para cada tipo de máscara e modo
        if (brush.erase) {
          // Modo borracha - cor laranja/amarela
          ctx.strokeStyle = '#ffc107';
        } else if (isExclusion) {
          // Máscara de exclusão - vermelho
          ctx.strokeStyle = '#ff4444';
        } else {
          // Máscara normal - branco
          ctx.strokeStyle = '#ffffff';
        }
        
        // Círculo externo (tamanho total do pincel)
        ctx.beginPath();
        ctx.arc(this.cursorImgX, this.cursorImgY, r, 0, effectsManager.TWO_PI);
        ctx.stroke();
        
        // Círculo interno (área da dureza) - linha mais fina
        if (innerR < r) {
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(this.cursorImgX, this.cursorImgY, innerR, 0, effectsManager.TWO_PI);
          ctx.stroke();
        }
        
        // Centro
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(this.cursorImgX, this.cursorImgY, 1, 0, effectsManager.TWO_PI);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  animate(time) {
    if (!this.gl || !window.userImage) return;
    
    // Verificar se a animação está habilitada
    const animationEnabled = effectsManager.getAnimationEnabled();
    
    // Se a animação está desabilitada, usar tempo fixo (pausa visual)
    const currentTime = animationEnabled ? time * 0.001 : 0;
    
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.useProgram(this.shaderProgram);

    // Obter efeitos ativos da lista global
    const effects = effectsManager.activeEffects;
    const n = Math.min(effects.length, MAX_EFFECTS);
    
    // Prepare effect data
    const effectTypes = new Int32Array(MAX_EFFECTS);
    const effectMarkers = new Float32Array(MAX_EFFECTS * 2);
    const effectStrengths = new Float32Array(MAX_EFFECTS);
    const effectRadii = new Float32Array(MAX_EFFECTS);
    const effectSoft = new Float32Array(MAX_EFFECTS);
    const effectSpeeds = new Float32Array(MAX_EFFECTS);
    const effectPhases = new Float32Array(MAX_EFFECTS);
    const effectParamsA = new Float32Array(MAX_EFFECTS * 4);
    const effectParamsB = new Float32Array(MAX_EFFECTS * 4);
    const effectColors = new Float32Array(MAX_EFFECTS * 4); // Para cores RGBA dos efeitos

    for (let i = 0; i < n; i++) {
      const e = effects[i];
      
      let effectType = effectsManager.EFFECT_TYPE_BREATHING;
      if (e.type === 'maskSway') effectType = effectsManager.EFFECT_TYPE_MASK_SWAY;
      if (e.type === 'wave') effectType = effectsManager.EFFECT_TYPE_WAVE;
      if (e.type === 'saber') effectType = effectsManager.EFFECT_TYPE_SABER;
      
      effectTypes[i] = effectType;
      effectMarkers[i * 2] = (e.marker?.x ?? 0);
      effectMarkers[i * 2 + 1] = (e.marker?.y ?? 0);
      effectStrengths[i] = e.strength ?? 0;
      effectRadii[i] = e.radius ?? 0;
      effectSoft[i] = e.softness ?? 0.4;
      effectSpeeds[i] = e.speed ?? 0;
      effectPhases[i] = e.phase ?? 0;
      effectParamsA[i * 4 + 0] = e.align ?? e.waveSize ?? e.turbulence ?? 0;   // Para maskSway: align, para wave: waveSize, para saber: turbulence
      effectParamsA[i * 4 + 1] = e.noiseScale ?? e.fuzziness ?? 0;          // Para saber: fuzziness
      effectParamsA[i * 4 + 2] = e.anchorHardness ?? e.baseSize ?? 0.5;     // Para saber: baseSize
      effectParamsA[i * 4 + 3] = e.verticalFalloff ?? 0;                    // Para saber: verticalFalloff
      effectParamsB[i * 4 + 0] = (e.wind?.x ?? e.waveDirection?.x ?? e.pulseIntensity ?? 0);    // Para saber: pulseIntensity
      effectParamsB[i * 4 + 1] = (e.wind?.y ?? e.waveDirection?.y ?? 0);    // Para maskSway: wind.y, para wave: waveDirection.y
      effectParamsB[i * 4 + 2] = 0.0; // Será definido abaixo para o efeito ativo
      effectParamsB[i * 4 + 3] = 0;
      
      // Processar cores para efeitos especiais (como saber)
      if (e.type === 'saber' && e.color) {
        // Converter cor hex para RGB
        const hexColor = e.color.replace('#', '');
        const r = parseInt(hexColor.substr(0, 2), 16) / 255.0;
        const g = parseInt(hexColor.substr(2, 2), 16) / 255.0;
        const b = parseInt(hexColor.substr(4, 2), 16) / 255.0;
        effectColors[i * 4 + 0] = r;
        effectColors[i * 4 + 1] = g;
        effectColors[i * 4 + 2] = b;
        effectColors[i * 4 + 3] = 1.0; // Alpha
      } else {
        // Cor padrão transparente para outros efeitos
        effectColors[i * 4 + 0] = 0.0;
        effectColors[i * 4 + 1] = 0.0;
        effectColors[i * 4 + 2] = 0.0;
        effectColors[i * 4 + 3] = 0.0;
      }
    }

    // Atribuir índices de máscara para todos os efeitos com máscara
    let maskIndex = 1;
    const maskEffects = [];
    
    for (let i = 0; i < n; i++) {
      const e = effects[i];
      if ((e.type === 'maskSway' || e.type === 'wave' || e.type === 'saber') && e.maskCanvas) {
        effectParamsB[i * 4 + 2] = maskIndex; // Usar índice da máscara em vez de apenas flag
        
        // Armazenar referência para upload de texturas
        maskEffects.push({
          effect: e,
          index: maskIndex,
          arrayIndex: i
        });
        
        maskIndex++;
        
        // Limitar a 3 máscaras simultâneas
        if (maskIndex > 3) break;
      }
    }

    // Set uniforms
    this.gl.uniform1i(this.uniforms.effect_count, n);
    this.gl.uniform1iv(this.uniforms.effect_types, effectTypes);
    this.gl.uniform2fv(this.uniforms.effect_markers, effectMarkers);
    this.gl.uniform1fv(this.uniforms.effect_strengths, effectStrengths);
    this.gl.uniform1fv(this.uniforms.effect_radii, effectRadii);
    this.gl.uniform1fv(this.uniforms.effect_softnesses, effectSoft);
    this.gl.uniform1fv(this.uniforms.effect_speeds, effectSpeeds);
    this.gl.uniform1fv(this.uniforms.effect_phases, effectPhases);
    this.gl.uniform4fv(this.uniforms.paramsA, effectParamsA);
    this.gl.uniform4fv(this.uniforms.paramsB, effectParamsB);
    this.gl.uniform4fv(this.uniforms.colors, effectColors);

    this.gl.uniform2f(this.uniforms.resolution, this.elements.canvas.width, this.elements.canvas.height);
    this.gl.uniform1i(this.uniforms.image, 0);
    this.gl.uniform1f(this.uniforms.time, currentTime);
    
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    
    // Configurar múltiplas máscaras
    maskEffects.forEach((maskData, idx) => {
      const textureUnit = this.gl.TEXTURE1 + idx;
      const uniformName = idx === 0 ? this.uniforms.mask : 
                         idx === 1 ? this.uniforms.mask2 : this.uniforms.mask3;
      
      this.gl.activeTexture(textureUnit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, maskData.effect.maskTexture);
      this.gl.uniform1i(uniformName, 1 + idx);
      
      if (idx === 0) {
        this.gl.uniform2f(this.uniforms.maskRes, this.elements.canvas.width, this.elements.canvas.height);
      }
    });

    if (this.exclusionMaskTexture) {
      this.gl.activeTexture(this.gl.TEXTURE4);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.exclusionMaskTexture);
      this.gl.uniform1i(this.uniforms.exclusion_mask, 4);
    }

    this.gl.activeTexture(this.gl.TEXTURE0);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.drawOverlay();
    
    this.animationFrameId = requestAnimationFrame((t) => this.animate(t));
  }

  // Public methods
  loadImage(image) {
    if (!this.gl && !this.initWebGL()) return false;
    
    this.elements.canvas.width = image.width;
    this.elements.canvas.height = image.height;
    this.elements.overlay.width = image.width;
    this.elements.overlay.height = image.height;
    
    this.gl.viewport(0, 0, this.elements.canvas.width, this.elements.canvas.height);
    this.createTexture(image);
    this.ensureMaskCanvas(this.elements.canvas.width, this.elements.canvas.height);
    this.ensureExclusionMaskCanvas(this.elements.canvas.width, this.elements.canvas.height);
    
    return true;
  }

  startAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animate(0);
  }

  pauseAnimation() {
    // Continuar o loop de animação mas com tempo fixo
    // Isso permite que o overlay continue sendo atualizado
    if (!this.animationFrameId) {
      this.animate(0);
    }
  }

  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Garantir que um efeito tenha seu próprio canvas de máscara
  ensureEffectMaskCanvas(effect, w, h) {
    if (effect.maskCanvas && effect.maskCanvas.width === w && effect.maskCanvas.height === h) return;
    
    effect.maskCanvas = document.createElement('canvas');
    effect.maskCanvas.width = w;
    effect.maskCanvas.height = h;
    effect.maskCtx = effect.maskCanvas.getContext('2d');
    effect.maskCtx.clearRect(0, 0, w, h);
    this.uploadEffectMaskTexture(effect);
  }

  // Upload da textura de máscara individual do efeito
  uploadEffectMaskTexture(effect) {
    if (!this.gl || !effect.maskCanvas) return;
    
    if (!effect.maskTexture) {
      effect.maskTexture = this.gl.createTexture();
    }
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, effect.maskTexture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, effect.maskCanvas);
  }

  // Limpar máscara de um efeito específico
  clearEffectMask(effect) {
    if (!effect.maskCanvas) return;
    effect.maskCtx.clearRect(0, 0, effect.maskCanvas.width, effect.maskCanvas.height);
    this.uploadEffectMaskTexture(effect);
  }

  reset() {
    this.stopAnimation();
    this.maskCanvas = null;
    this.maskCtx = null;
    this.maskTexture = null;
    this.exclusionMaskCanvas = null;
    this.exclusionMaskCtx = null;
    this.exclusionMaskTexture = null;
    this.cursorImgX = null;
    this.cursorImgY = null;
    this.painting = false;
    
    if (this.gl) {
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
  }
}

// Criar instância global
const webglRenderer = new WebGLRenderer();

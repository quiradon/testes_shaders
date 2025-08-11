// Shaders WebGL para efeitos de animação
const Shaders = {
  vertex: `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_position * 0.5 + 0.5;
    }
  `,

  fragment: `
    precision mediump float;
    const int MAX_EFFECTS = 50;
    const int EFFECT_TYPE_BREATHING = 1;
    const int EFFECT_TYPE_MASK_SWAY = 2;
    const int EFFECT_TYPE_EXCLUSION_MASK = 3;
    const int EFFECT_TYPE_WAVE = 4;
    const int EFFECT_TYPE_SABER = 5;

    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_effect_count;

    uniform int   u_effect_types[MAX_EFFECTS];
    uniform vec2  u_effect_markers[MAX_EFFECTS];
    uniform float u_effect_strengths[MAX_EFFECTS];
    uniform float u_effect_radii[MAX_EFFECTS];
    uniform float u_effect_softnesses[MAX_EFFECTS];
    uniform float u_effect_speeds[MAX_EFFECTS];
    uniform float u_effect_phases[MAX_EFFECTS];

    uniform vec4  u_effect_paramsA[MAX_EFFECTS]; // x: align/waveSize/turbulence, y: noiseScale, z: anchorHardness, w: livre
    uniform vec4  u_effect_paramsB[MAX_EFFECTS]; // x: windX/waveDirectionX, y: windY/waveDirectionY, z/w livres
    uniform vec4  u_effect_colors[MAX_EFFECTS];  // Cores para efeitos especiais como saber

    uniform sampler2D u_mask;              // máscara pintada (A)
    uniform sampler2D u_mask2;             // segunda máscara
    uniform sampler2D u_mask3;             // terceira máscara
    uniform sampler2D u_exclusion_mask;    // máscara de exclusão
    uniform vec2      u_mask_resolution;   // tamanho em px

    varying vec2 v_texCoord;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 finalTexCoord = v_texCoord;
      
      // Verificar se este pixel está em uma área de exclusão
      float exclusionMask = texture2D(u_exclusion_mask, finalTexCoord).a;
      bool isExcluded = exclusionMask > 0.5;

      // Variáveis para acumular overlays coloridos
      vec3 overlayColor = vec3(0.0);
      float overlayAlpha = 0.0;

      for (int i = 0; i < MAX_EFFECTS; i++) {
        if (i >= u_effect_count) break;

        // Pular efeitos se estivermos em uma zona de exclusão
        // (exceto o próprio efeito de máscara de exclusão)
        if (isExcluded && u_effect_types[i] != EFFECT_TYPE_EXCLUSION_MASK) {
          continue;
        }

        if (u_effect_types[i] == EFFECT_TYPE_BREATHING) {
          vec2 aspect_correction = vec2(1.0, u_resolution.y / u_resolution.x);
          if (u_resolution.x > u_resolution.y) { 
            aspect_correction = vec2(u_resolution.x / u_resolution.y, 1.0); 
          }
          
          vec2 direction = finalTexCoord - u_effect_markers[i];
          float distance = length(direction * aspect_correction);
          float breath_cycle = -cos(u_time * u_effect_speeds[i] + u_effect_phases[i]) * 0.5 + 0.5;
          float bulge_falloff = smoothstep(u_effect_radii[i], 0.0, distance);
          float softness = max(0.001, u_effect_softnesses[i]);
          float center_softness = smoothstep(0.0, u_effect_radii[i] * softness, distance);
          float displacement_amount = center_softness * bulge_falloff * breath_cycle * u_effect_strengths[i];
          
          if (distance < u_effect_radii[i]) { 
            finalTexCoord -= normalize(direction) * displacement_amount; 
          }
        }

        if (u_effect_types[i] == EFFECT_TYPE_MASK_SWAY) {
          // Verificar se este efeito específico tem máscara pintada
          // Usar u_effect_paramsB[i].z como flag para indicar qual textura usar
          float maskIndex = u_effect_paramsB[i].z;
          
          if (maskIndex > 0.5) {
            float m = 0.0;
            
            // Selecionar a máscara correta baseada no índice
            if (maskIndex < 1.5) {
              m = texture2D(u_mask, finalTexCoord).a;
            } else if (maskIndex < 2.5) {
              m = texture2D(u_mask2, finalTexCoord).a;
            } else if (maskIndex < 3.5) {
              m = texture2D(u_mask3, finalTexCoord).a;
            }
            
            if (m > 0.001) {
              // Suavização otimizada da máscara para transições muito mais naturais
              vec2 texel = 1.0 / u_mask_resolution;
              
              // Amostragem em cruz com pontos mais próximos para melhor suavização
              float m_center = m;
              float m_left, m_right, m_up, m_down;
              float m_tl, m_tr, m_bl, m_br;
              
              // Aplicar amostragem baseada na textura selecionada
              if (maskIndex < 1.5) {
                m_left = texture2D(u_mask, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask, finalTexCoord + texel).a;
              } else if (maskIndex < 2.5) {
                m_left = texture2D(u_mask2, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask2, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask2, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask2, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask2, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask2, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask2, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask2, finalTexCoord + texel).a;
              } else {
                m_left = texture2D(u_mask3, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask3, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask3, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask3, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask3, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask3, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask3, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask3, finalTexCoord + texel).a;
              }
              
              // Média ponderada com filtro gaussiano aproximado
              float smoothMask = (
                m_center * 0.25 + 
                (m_left + m_right + m_up + m_down) * 0.125 +
                (m_tl + m_tr + m_bl + m_br) * 0.0625
              );
              
              // Aplicar múltiplas curvas de suavização para transições ultra suaves
              smoothMask = smoothstep(0.02, 0.98, smoothMask);
              smoothMask = smoothMask * smoothMask * (3.0 - 2.0 * smoothMask); // Curva suave adicional
              
              float speed = u_effect_speeds[i];
              float phase = u_effect_phases[i];
              float nscale = max(0.001, u_effect_paramsA[i].y);
              
              // Criar ondulação suave tipo liquify com frequências mais baixas para evitar listras
              vec2 wavePos = finalTexCoord * nscale;
              
              // Múltiplas ondas com frequências reduzidas para movimento mais suave
              float wave1 = sin(wavePos.x * 2.5 + u_time * speed + phase) * 0.5;
              float wave2 = sin(wavePos.y * 1.8 + u_time * speed * 0.7) * 0.4;
              float wave3 = sin((wavePos.x + wavePos.y) * 1.2 + u_time * speed * 0.9) * 0.3;
              
              // Combinar ondas para movimento mais complexo e orgânico
              vec2 displacement = vec2(
                wave1 + sin(wavePos.y * 0.8 + u_time * speed * 0.5) * 0.3,
                wave2 + sin(wavePos.x * 1.3 + u_time * speed * 0.6) * 0.25
              );
              
              // Adicionar ruído muito sutil para variação natural sem criar listras
              float noise = hash12(finalTexCoord * nscale * 0.5); // Reduzir escala do ruído
              displacement += vec2(sin(noise * 6.28318 + u_time * speed * 0.3), 
                                 cos(noise * 6.28318 + u_time * speed * 0.3)) * 0.05; // Reduzir intensidade
              
              // Vento constante suave
              vec2 wind = u_effect_paramsB[i].xy;
              displacement += wind;
              
              // Usar máscara suavizada para transições mais naturais
              displacement *= smoothMask;
              
              // Aplicar força do efeito
              float amount = u_effect_strengths[i];
              finalTexCoord += displacement * amount;
            }
          }
        }

        // O efeito de máscara de exclusão não faz nada por si só,
        // apenas marca as áreas que devem ser excluídas
        if (u_effect_types[i] == EFFECT_TYPE_EXCLUSION_MASK) {
          // Este efeito não modifica as coordenadas de textura
        }

        if (u_effect_types[i] == EFFECT_TYPE_WAVE) {
          // Verificar se este efeito específico tem máscara pintada
          // Usar u_effect_paramsB[i].z como flag para indicar qual textura usar
          float maskIndex = u_effect_paramsB[i].z;
          
          if (maskIndex > 0.5) {
            float m = 0.0;
            
            // Selecionar a máscara correta baseada no índice
            if (maskIndex < 1.5) {
              m = texture2D(u_mask, finalTexCoord).a;
            } else if (maskIndex < 2.5) {
              m = texture2D(u_mask2, finalTexCoord).a;
            } else if (maskIndex < 3.5) {
              m = texture2D(u_mask3, finalTexCoord).a;
            }
            
            if (m > 0.001) {
              // Suavização da máscara
              vec2 texel = 1.0 / u_mask_resolution;
              
              // Amostragem em cruz para suavização
              float m_center = m;
              float m_left, m_right, m_up, m_down;
              float m_tl, m_tr, m_bl, m_br;
              
              // Aplicar amostragem baseada na textura selecionada
              if (maskIndex < 1.5) {
                m_left = texture2D(u_mask, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask, finalTexCoord + texel).a;
              } else if (maskIndex < 2.5) {
                m_left = texture2D(u_mask2, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask2, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask2, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask2, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask2, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask2, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask2, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask2, finalTexCoord + texel).a;
              } else {
                m_left = texture2D(u_mask3, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask3, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask3, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask3, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask3, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask3, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask3, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask3, finalTexCoord + texel).a;
              }
              
              // Média ponderada com filtro gaussiano aproximado
              float smoothMask = (
                m_center * 0.25 + 
                (m_left + m_right + m_up + m_down) * 0.125 +
                (m_tl + m_tr + m_bl + m_br) * 0.0625
              );
              
              // Aplicar múltiplas curvas de suavização para transições ultra suaves
              smoothMask = smoothstep(0.02, 0.98, smoothMask);
              smoothMask = smoothMask * smoothMask * (3.0 - 2.0 * smoothMask); // Curva suave adicional
              
              // Parâmetros personalizáveis das ondas
              float waveSize = u_effect_paramsA[i].x;    // Tamanho das ondas
              float waveSpeed = u_effect_speeds[i];      // Velocidade
              vec2 waveDirection = u_effect_paramsB[i].xy; // Direção (x, y)
              float waveIntensity = u_effect_strengths[i]; // Intensidade
              
              // Criar ondas direcionais
              vec2 wavePos = finalTexCoord * waveSize;
              float directionalWave = dot(wavePos, normalize(waveDirection + vec2(0.001, 0.001))); // Evitar direção zero
              
              // Múltiplas frequências para ondas mais naturais
              float wave1 = sin(directionalWave * 3.0 + u_time * waveSpeed + u_effect_phases[i]);
              float wave2 = sin(directionalWave * 5.0 + u_time * waveSpeed * 0.7) * 0.5;
              float wave3 = sin(directionalWave * 8.0 + u_time * waveSpeed * 0.4) * 0.25;
              
              // Combinar ondas
              float combinedWave = wave1 + wave2 + wave3;
              
              // Criar deslocamento perpendicular à direção da onda
              vec2 perpDirection = vec2(-waveDirection.y, waveDirection.x);
              vec2 displacement = perpDirection * combinedWave * waveIntensity * smoothMask;
              
              finalTexCoord += displacement;
            }
          }
        }

        if (u_effect_types[i] == EFFECT_TYPE_SABER) {
          // Verificar se este efeito específico tem máscara pintada
          // Usar u_effect_paramsB[i].z como flag para indicar qual textura usar
          float maskIndex = u_effect_paramsB[i].z;
          
          if (maskIndex > 0.5) {
            float m = 0.0;
            
            // Selecionar a máscara correta baseada no índice
            if (maskIndex < 1.5) {
              m = texture2D(u_mask, finalTexCoord).a;
            } else if (maskIndex < 2.5) {
              m = texture2D(u_mask2, finalTexCoord).a;
            } else if (maskIndex < 3.5) {
              m = texture2D(u_mask3, finalTexCoord).a;
            }
            
            // Reduzir o threshold para detectar pixels pintados
            if (m > 0.001) {
              // Suavização mais agressiva da máscara
              vec2 texel = 1.0 / u_mask_resolution;
              
              // Amostragem expandida para suavização
              float m_center = m;
              float m_left, m_right, m_up, m_down;
              float m_tl, m_tr, m_bl, m_br;
              
              // Aplicar amostragem baseada na textura selecionada
              if (maskIndex < 1.5) {
                m_left = texture2D(u_mask, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask, finalTexCoord + texel).a;
              } else if (maskIndex < 2.5) {
                m_left = texture2D(u_mask2, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask2, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask2, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask2, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask2, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask2, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask2, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask2, finalTexCoord + texel).a;
              } else {
                m_left = texture2D(u_mask3, finalTexCoord - vec2(texel.x, 0.0)).a;
                m_right = texture2D(u_mask3, finalTexCoord + vec2(texel.x, 0.0)).a;
                m_up = texture2D(u_mask3, finalTexCoord - vec2(0.0, texel.y)).a;
                m_down = texture2D(u_mask3, finalTexCoord + vec2(0.0, texel.y)).a;
                m_tl = texture2D(u_mask3, finalTexCoord - texel).a;
                m_tr = texture2D(u_mask3, finalTexCoord + vec2(texel.x, -texel.y)).a;
                m_bl = texture2D(u_mask3, finalTexCoord + vec2(-texel.x, texel.y)).a;
                m_br = texture2D(u_mask3, finalTexCoord + texel).a;
              }
              
              // Média ponderada expandida para suavização melhor
              float smoothMask = (
                m_center * 0.3 + 
                (m_left + m_right + m_up + m_down) * 0.12 +
                (m_tl + m_tr + m_bl + m_br) * 0.05
              );
              smoothMask = smoothstep(0.02, 0.98, smoothMask);
              
              // Parâmetros do efeito saber (inspirado no código Three.js)
              float intensity = u_effect_strengths[i];          // brightnessMultiplier
              float fireSpeed = u_effect_speeds[i];             // fireSpeed
              float turbulence = u_effect_paramsA[i].x;         // noiseMultiplier/turbulence
              float fuzziness = u_effect_paramsA[i].y;          // fuzziness
              float baseSize = u_effect_paramsA[i].z;           // baseSize
              float verticalFalloff = u_effect_paramsA[i].w;    // verticalFalloff
              float pulseIntensity = u_effect_paramsB[i].x;     // pulseIntensity
              vec3 outerColor = u_effect_colors[i].rgb;         // outerColorBase
              
              // Posição normalizada para o efeito
              vec2 pos = finalTexCoord;
              float time = u_time * fireSpeed;
              
              // === SISTEMA DE RUÍDO PROCEDURAL (inspirado no Three.js) ===
              
              // Múltiplas escalas de ruído para complexidade
              float noiseScale = 0.8;
              vec2 noiseCoord = pos * noiseScale * 15.0;
              
              // Função de ruído usando senos (substituto para textura de ruído)
              float noise1 = sin(noiseCoord.x * 2.4 + time * 1.2) * cos(noiseCoord.y * 1.8 + time * 0.9);
              float noise2 = sin(noiseCoord.x * 4.1 + time * 0.7) * cos(noiseCoord.y * 3.3 + time * 1.4);
              float noise3 = sin(noiseCoord.x * 6.8 + time * 1.8) * cos(noiseCoord.y * 5.2 + time * 0.6);
              float noise4 = sin(noiseCoord.x * 8.3 + time * 2.1) * cos(noiseCoord.y * 7.9 + time * 1.1);
              
              // Combinar ruídos com diferentes pesos (fractional noise)
              float combinedNoise = (
                noise1 * 0.5 +
                noise2 * 0.25 +
                noise3 * 0.125 +
                noise4 * 0.125
              ) * 0.5 + 0.5;
              
              // === DISTORÇÃO E TURBULÊNCIA ===
              
              // Distorção baseada em turbulência
              float distortionPower = 3.0 + turbulence * 2.0;
              vec2 distortion = vec2(
                sin(pos.x * 8.0 + time * 2.0 + combinedNoise * 6.28318) * 0.1,
                sin(pos.y * 6.0 + time * 1.5 + combinedNoise * 6.28318) * 0.15
              ) * distortionPower;
              
              vec2 distortedPos = pos + distortion * smoothMask * 0.1;
              
              // === GRADIENTE VERTICAL (falloff) ===
              
              // Falloff vertical mais forte no topo (como chama real)
              // Usar parâmetro verticalFalloff personalizado
              float verticalFalloffPower = max(1.0, verticalFalloff);
              float heightGradient = smoothstep(0.2, 1.0, distortedPos.y);
              heightGradient = pow(heightGradient, verticalFalloffPower);
              
              // === FORMA BASE DO FOGO ===
              
              // Distância do centro horizontal para forma de chama
              // Usar parâmetro baseSize personalizado
              float centerDist = abs(distortedPos.x - 0.5) * 2.0;
              float baseSizeScaled = max(0.1, baseSize);
              float baseShape = smoothstep(baseSizeScaled, 0.0, centerDist);
              
              // === MÚLTIPLAS CAMADAS DE INTENSIDADE ===
              
              // Camada externa (outer step)
              float outerStep = 0.3;
              float outerIntensity = smoothstep(outerStep, 0.0, centerDist) * heightGradient;
              
              // Camada interna (inner step) - mais brilhante
              float innerStep = 0.15;
              float innerIntensity = smoothstep(innerStep, 0.0, centerDist) * heightGradient;
              
              // === APLICAÇÃO DO RUÍDO ===
              
              // Modular intensidades pelo ruído
              outerIntensity *= combinedNoise * 0.8 + 0.2;
              innerIntensity *= combinedNoise * 0.9 + 0.1;
              
              // === INTENSIDADE FINAL ===
              
              float finalIntensity = max(outerIntensity, innerIntensity * 1.5);
              
              // Aplicar multiplicador de brilho
              finalIntensity *= intensity * 25.0; // Reduzir de 50.0 para 25.0 para diminuir intensidade padrão
              
              // === CINTILAÇÃO AVANÇADA ===
              
              // Múltiplas frequências de cintilação (como no código original)
              float flicker1 = sin(time * 12.0 + pos.x * 10.0) * 0.1;
              float flicker2 = sin(time * 18.0 + pos.y * 15.0) * 0.08;
              float flicker3 = sin(time * 25.0 + combinedNoise * 20.0) * 0.06;
              float flicker = (flicker1 + flicker2 + flicker3) + 1.0;
              
              // === PULSAÇÃO DE COR INTENSA ===
              
              // Pulsação principal (batimento cardíaco da chama)
              float mainPulse = sin(time * 3.0) * 0.5 + 0.5; // Ciclo lento e suave
              float heartbeat = sin(time * 8.0) * 0.3 + 0.7; // Batimento mais rápido
              float quickFlicker = sin(time * 15.0) * 0.2 + 0.8; // Cintilação rápida
              
              // Combinar pulsações para efeito complexo
              float colorPulse = mainPulse * heartbeat * quickFlicker;
              colorPulse = smoothstep(0.2, 1.0, colorPulse); // Suavizar e intensificar
              
              finalIntensity *= flicker;
              
              // === FUZZINESS (suavização das bordas) ===
              
              // Usar parâmetro fuzziness personalizado
              float fuzzinessAmount = max(0.1, fuzziness);
              finalIntensity = smoothstep(0.0, fuzzinessAmount, finalIntensity);
              
              // Aplicar máscara pintada
              finalIntensity *= smoothMask;
              
              // Limitar valores
              finalIntensity = clamp(finalIntensity, 0.0, 7.0); // Reduzir de 10.0 para 7.0
              
              // === VARIAÇÃO DINÂMICA DE COR COM PULSAÇÃO INTENSA ===
              
              // Saturar drasticamente a cor base
              vec3 baseSaturatedColor = outerColor * 2.0; // Dobrar a saturação base
              
              // Cor interna (mais quente/brilhante) - muito mais intensa
              vec3 innerColor = mix(baseSaturatedColor, vec3(1.0, 1.0, 0.3), 0.8);
              
              // Combinar cores baseado nas intensidades com pulsação
              vec3 fireColor = mix(baseSaturatedColor, innerColor, innerIntensity / max(outerIntensity, 0.001));
              
              // === SISTEMA DE PULSAÇÃO DE COR ===
              
              // Aplicar pulsação de cor - cores ficam muito mais vivas durante pulsos
              float pulseMultiplier = max(0.1, pulseIntensity); // Garantir que nunca seja zero
              float colorBoost = 1.0 + colorPulse * (2.0 + pulseMultiplier * 2.0); // Até 5x mais intensa com pulsação máxima
              fireColor *= colorBoost;
              
              // === VARIAÇÃO EXTREMA DE COR POR INTENSIDADE ===
              
              vec3 finalFireColor = fireColor;
              
              if (finalIntensity > 1.0) {
                // Áreas brilhantes ficam muito saturadas e coloridas
                float saturationBoost = (finalIntensity - 1.0) / 9.0;
                vec3 hyperSaturated = fireColor * (1.5 + saturationBoost * 2.0);
                finalFireColor = mix(fireColor, hyperSaturated, saturationBoost);
              }
              
              if (finalIntensity > 3.0) {
                // Áreas muito brilhantes pulsam entre a cor original e branco quente
                float whiteness = sin(time * 20.0) * 0.3 + 0.7; // Pulsação rápida
                vec3 hotWhite = mix(finalFireColor, vec3(1.0, 0.9, 0.7), 0.4);
                finalFireColor = mix(finalFireColor, hotWhite, whiteness * 0.6);
              }
              
              if (finalIntensity > 5.0) {
                // Áreas extremamente brilhantes criam arco-íris de energia
                float rainbow = sin(time * 10.0 + pos.x * 20.0) * 0.5 + 0.5;
                vec3 energyColor = vec3(
                  sin(rainbow * 6.28318),
                  sin(rainbow * 6.28318 + 2.094),
                  sin(rainbow * 6.28318 + 4.188)
                ) * 0.5 + 0.5;
                energyColor = mix(energyColor, finalFireColor, 0.7); // Manter conexão com cor base
                finalFireColor = mix(finalFireColor, energyColor, 0.3);
              }
              
              // === BOOST FINAL DE SATURAÇÃO ===
              
              // Aumentar saturação geral drasticamente
              float luminance = dot(finalFireColor, vec3(0.299, 0.587, 0.114));
              vec3 saturatedColor = finalFireColor + (finalFireColor - vec3(luminance)) * 2.0; // Dobrar saturação
              finalFireColor = mix(finalFireColor, saturatedColor, 0.8);
              
              // Garantir que nunca fique muito escuro - sempre brilhante e colorido
              finalFireColor = max(finalFireColor, outerColor * 0.3);
              
              // Acumular o overlay colorido com intensidade muito maior
              overlayColor += finalFireColor * finalIntensity;
              overlayAlpha = max(overlayAlpha, finalIntensity * 0.9);
            }
          }
        }
      }

      finalTexCoord = clamp(finalTexCoord, 0.0, 1.0);
      
      // Obter cor base da imagem
      vec4 baseColor = texture2D(u_image, finalTexCoord);
      
      // Aplicar overlay colorido do saber usando blend mode "screen" e "add" combinados
      if (overlayAlpha > 0.0) {
        // Usar múltiplos blend modes para efeito mais intenso
        
        // Screen blend para efeito luminoso base
        vec3 screenBlend = 1.0 - (1.0 - baseColor.rgb) * (1.0 - overlayColor);
        
        // Add blend para áreas mais intensas
        vec3 addBlend = baseColor.rgb + overlayColor;
        
        // Combinar os dois modos baseado na intensidade
        float blendFactor = smoothstep(0.3, 1.0, overlayAlpha);
        vec3 combinedBlend = mix(screenBlend, addBlend, blendFactor * 0.6);
        
        // Aplicar o blend final com intensidade controlada
        baseColor.rgb = mix(baseColor.rgb, combinedBlend, min(overlayAlpha * 1.5, 1.0)); // Reduzir de 2.0 para 1.5
        
        // Adicionar brilho extra para efeito dramático mas controlado
        vec3 glowColor = overlayColor * overlayAlpha;
        baseColor.rgb += glowColor * 1.0; // Reduzir de 1.5 para 1.0
        
        // Saturar cores em áreas muito brilhantes
        float brightness = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
        if (brightness > 0.8) {
          vec3 saturatedColor = overlayColor * 1.2;
          baseColor.rgb = mix(baseColor.rgb, saturatedColor, (brightness - 0.8) * 2.0);
        }
        
        // Manter dentro do range válido mas permitir overbrights extremos
        baseColor.rgb = clamp(baseColor.rgb, 0.0, 5.0); // Permitir muito overbright para máxima visibilidade
      }
      
      gl_FragColor = baseColor;
    }
  `
};

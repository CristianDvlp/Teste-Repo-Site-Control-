(function () {
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduzirMovimento.matches) return;

  const canvas = document.getElementById('backgroundFx');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let largura = 0;
  let altura = 0;
  let animationFrame = null;
  let resizeTimer = null;
  let scrollTimer = null;
  let pausadoPorScroll = false;
  let ultimoFrame = 0;

  const particulas = [];
  const mouse = {
    x: 0,
    y: 0,
    ativo: false
  };

  const CONFIG = {
    densidade: 16000,
    tamanhoMin: 1.4,
    tamanhoMax: 3,
    velocidadeBase: 0.24,
    distanciaLigacao: 145,
    distanciaMouse: 155,
    fps: 30,
    corPonto: '212, 175, 55',
    corLinha: '212, 175, 55'
  };

  const intervaloFrame = 1000 / CONFIG.fps;

  function numeroAleatorio(min, max) {
    return Math.random() * (max - min) + min;
  }

  function limitar(valor, min, max) {
    return Math.max(min, Math.min(max, valor));
  }

  function redimensionarCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

    largura = window.innerWidth;
    altura = window.innerHeight;

    canvas.width = Math.floor(largura * dpr);
    canvas.height = Math.floor(altura * dpr);
    canvas.style.width = `${largura}px`;
    canvas.style.height = `${altura}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    criarParticulas();
  }

  function criarParticulas() {
    particulas.length = 0;

    const total = limitar(
      Math.round((largura * altura) / CONFIG.densidade),
      20,
      42
    );

    for (let i = 0; i < total; i++) {
      particulas.push({
        x: numeroAleatorio(0, largura),
        y: numeroAleatorio(0, altura),
        vx: numeroAleatorio(-CONFIG.velocidadeBase, CONFIG.velocidadeBase),
        vy: numeroAleatorio(-CONFIG.velocidadeBase, CONFIG.velocidadeBase),
        r: numeroAleatorio(CONFIG.tamanhoMin, CONFIG.tamanhoMax)
      });
    }
  }

  function atualizarMouse(event) {
    const elemento = event.target instanceof Element ? event.target : null;

    if (elemento?.closest(
      '.card, header, .sidebar-hover, .sidebar-link, .tab-btn, ' +
      'button, input, select, textarea, label, a, table, .table-wrapper, ' +
      '.chart-box, .actions, .status, .filters'
    )) {
      mouse.ativo = false;
      return;
    }

    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.ativo = true;
  }

  function atualizarParticulas() {
    for (const p of particulas) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x <= 0 || p.x >= largura) p.vx *= -1;
      if (p.y <= 0 || p.y >= altura) p.vy *= -1;

      p.x = limitar(p.x, 0, largura);
      p.y = limitar(p.y, 0, altura);

      if (mouse.ativo) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0 && dist < CONFIG.distanciaMouse) {
          const forca = (CONFIG.distanciaMouse - dist) / CONFIG.distanciaMouse;

          // efeito de "empurrar" levemente as partículas
          p.x -= (dx / dist) * forca * 0.9;
          p.y -= (dy / dist) * forca * 0.9;
        }
      }
    }
  }

  function desenharGlowMouse() {
    if (!mouse.ativo) return;

    const gradiente = ctx.createRadialGradient(
      mouse.x, mouse.y, 0,
      mouse.x, mouse.y, CONFIG.distanciaMouse
    );

gradiente.addColorStop(0, 'rgba(212, 175, 55, 0.22)');
gradiente.addColorStop(0.45, 'rgba(212, 175, 55, 0.08)');
gradiente.addColorStop(1, 'rgba(212, 175, 55, 0)');

    ctx.beginPath();
    ctx.fillStyle = gradiente;
    ctx.arc(mouse.x, mouse.y, CONFIG.distanciaMouse, 0, Math.PI * 2);
    ctx.fill();
  }

  function desenharLinhasEntreParticulas() {
    for (let i = 0; i < particulas.length; i++) {
      for (let j = i + 1; j < particulas.length; j++) {
        const a = particulas[i];
        const b = particulas[j];

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distanciaQuadrada = (dx * dx) + (dy * dy);
        const limiteQuadrado = CONFIG.distanciaLigacao * CONFIG.distanciaLigacao;

        if (distanciaQuadrada <= limiteQuadrado) {
          const dist = Math.sqrt(distanciaQuadrada);
          const alpha = (1 - dist / CONFIG.distanciaLigacao) * 0.38;

          ctx.beginPath();
          ctx.strokeStyle = `rgba(${CONFIG.corLinha}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }

  function desenharLinhasDoMouse() {
    if (!mouse.ativo) return;

    for (const p of particulas) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const distanciaQuadrada = (dx * dx) + (dy * dy);
      const limiteQuadrado = CONFIG.distanciaMouse * CONFIG.distanciaMouse;

      if (distanciaQuadrada <= limiteQuadrado) {
        const dist = Math.sqrt(distanciaQuadrada);
        const alpha = (1 - dist / CONFIG.distanciaMouse) * 0.5;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${CONFIG.corLinha}, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
  }

  function desenharParticulas() {
    for (const p of particulas) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${CONFIG.corPonto}, 0.75)`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderizar(agora = 0) {
    animationFrame = requestAnimationFrame(renderizar);

    if (document.hidden || pausadoPorScroll) return;
    if (agora - ultimoFrame < intervaloFrame) return;

    ultimoFrame = agora;
    ctx.clearRect(0, 0, largura, altura);

    desenharGlowMouse();
    desenharLinhasEntreParticulas();
    desenharLinhasDoMouse();
    desenharParticulas();

    atualizarParticulas();
  }

  function pausarDuranteRolagem() {
    pausadoPorScroll = true;
    mouse.ativo = false;
    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {
      pausadoPorScroll = false;
      ultimoFrame = 0;
    }, 180);
  }

  function iniciar() {
    redimensionarCanvas();

    document.addEventListener('mousemove', atualizarMouse, { passive: true });

    document.addEventListener('mouseleave', () => {
      mouse.ativo = false;
    });

    window.addEventListener('blur', () => {
      mouse.ativo = false;
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) ultimoFrame = 0;
    });

    window.addEventListener('scroll', pausarDuranteRolagem, { passive: true });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        redimensionarCanvas();
        ultimoFrame = 0;
      }, 150);
    }, { passive: true });

    renderizar();
  }

  iniciar();
})();

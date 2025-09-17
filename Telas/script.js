// ===================== UTILIDADES =====================
const TIMEOUTS = new Set();

/** Limpa todos os timeouts pendentes (evita trocas de tela “fantasma”) */
function clearAllTimeouts() {
  for (const t of TIMEOUTS) clearTimeout(t);
  TIMEOUTS.clear();
}

/** Agenda um setTimeout e guarda a referência para poder limpar depois */
function wait(ms, cb) {
  const t = setTimeout(() => {
    TIMEOUTS.delete(t);
    cb();
  }, ms);
  TIMEOUTS.add(t);
}

/** Mostra apenas a tela com o ID dado e esconde o resto */
function mostrarTela(id) {
  document.querySelectorAll('.tela').forEach(t => (t.style.display = 'none'));
  const alvo = document.getElementById(id);
  if (alvo) alvo.style.display = 'flex';
}

/** Adiciona listener de forma segura (só liga se o seletor existir) */
function on(selector, event, handler) {
  const el = document.querySelector(selector);
  if (el) el.addEventListener(event, handler);
  return !!el;
}

// Estado simples para sabermos para onde ir após verificar código
const appState = {
  nextAfterVerify: 'tela-login', // por padrão, verificar código leva ao login
};

// Exponho algumas funções globalmente caso queiras chamar via HTML inline
window.appFlow = { mostrarTela, clearAllTimeouts };


// ===================== (NOVO) VALIDAÇÃO GENÉRICA data-match =====================
// Não altera o fluxo. Só valida se existirem inputs com data-match no HTML.
(function () {
  function getTargetWithinForm(confirmInput) {
    const form = confirmInput.closest('form');
    if (!form) return null;

    const selector = confirmInput.dataset.match || '';
    let target = null;

    if (selector) {
      try {
        target = form.querySelector(selector) || document.querySelector(selector);
      } catch (_) { /* selector inválido */ }
    }

    // Alternativa: se quiseres, podes suportar data-match-name:
    if (!target && confirmInput.dataset.matchName) {
      target = form.querySelector(`[name="${confirmInput.dataset.matchName}"]`);
    }

    return target;
  }

  function attachMatchingValidation(confirmInput) {
    const target = getTargetWithinForm(confirmInput);
    if (!target) return;

    const msg = confirmInput.dataset.matchMsg || 'Os valores não coincidem.';

    const validate = () => {
      // Deixa o required nativo agir quando vazio
      if (confirmInput.required && confirmInput.value === '') {
        confirmInput.setCustomValidity('');
        return;
      }
      confirmInput.setCustomValidity(confirmInput.value !== target.value ? msg : '');
    };

    confirmInput.addEventListener('input', validate);
    target.addEventListener('input', validate);
    confirmInput.addEventListener('blur', validate);
    target.addEventListener('blur', validate);
    validate();

    // Garante reporte de validade no submit (sem mexer no teu fluxo)
    const form = confirmInput.closest('form');
    if (form && !form.__hasMatchHandler) {
      form.addEventListener('submit', (e) => {
        if (!form.checkValidity && typeof form.reportValidity !== 'function') return;
        if (!form.checkValidity()) {
          e.preventDefault();
          form.reportValidity();
        }
      });
      form.__hasMatchHandler = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[data-match]').forEach(attachMatchingValidation);
  });
})();


// ===================== FLUXO PRINCIPAL =====================
/**
 * Sequência pedida:
 * - tela-inicio → 3s
 * - tela-bem-vindo-1 → 3s
 * - tela-bem-vindo-2 → sem tempo (user clica "Próximo")
 * - tela-bem-vindo-3 → sem tempo (user clica "Continuar")
 * Depois segue (criar conta → verificar código → login)
 */
function iniciarSequencia() {
  clearAllTimeouts();

  // 1) Início (3s)
  mostrarTela('tela-inicio');

  wait(3000, () => {
    // 2) Bem-vindo 1 (3s)
    mostrarTela('tela-bem-vindo-1');

    wait(3000, () => {
      // 3) Bem-vindo 2 (aguarda clique do utilizador)
      mostrarTela('tela-bem-vindo-2');
    });
  });
}

/** Volta para a tela de login e limpa timeouts */
function logout() {
  clearAllTimeouts();
  mostrarTela('tela-login');
}


// ===================== NAVEGAÇÃO / FORMULÁRIOS =====================
function configurarBotoes() {
  // ---- Bem-vindo 2 → Bem-vindo 3 (botão Próximo) ----
  on('#btn-proximo', 'click', () => {
    clearAllTimeouts();
    mostrarTela('tela-bem-vindo-3');
  });

  // ---- Bem-vindo 3 → Criar Conta (botão Continuar) ----
  on('#btn-continuar', 'click', () => {
    clearAllTimeouts();
    mostrarTela('tela-criar-conta');
  });

  // ---- Criar Conta → Verificar Código (submit) ----
  on('#tela-criar-conta form', 'submit', e => {
    e.preventDefault();
    alert('Conta criada com sucesso!');
    // Neste fluxo, após verificar código queremos ir para login:
    appState.nextAfterVerify = 'tela-login';
    mostrarTela('tela-verificar-codigo');
  });

  // (Link “ENTRAR” dentro da tela criar conta — intercepta navegação)
  on('#tela-criar-conta a[href="/entrar"]', 'click', e => {
    e.preventDefault();
    mostrarTela('tela-login');
  });

  // ---- Recuperar senha (email) → Verificar Código (submit) ----
  on('#tela-recuperar-senha-email form', 'submit', e => {
    e.preventDefault();
    alert('Enviámos um código para o teu e-mail.');
    // Este fluxo veio de “esqueci a senha”, então após verificar vamos para redefinir-senha:
    appState.nextAfterVerify = 'redefinir-senha';
    mostrarTela('tela-verificar-codigo');
  });

  // ---- Verificar Código → próximo consoante o estado ----
  on('#tela-verificar-codigo form', 'submit', e => {
    e.preventDefault();
    alert('Código verificado com sucesso!');
    mostrarTela(appState.nextAfterVerify || 'tela-login');
  });

  // ---- Redefinir Senha (submit) → Login ----
  on('#redefinir-senha .auth-form', 'submit', e => {
    e.preventDefault();
    // Podes validar aqui a nova senha/confirmar, se tiveres os campos
    alert('Senha redefinida com sucesso!');
    mostrarTela('tela-login');
  });

  // ---- Login (submit) — usa .auth-form dentro de #tela-login ----
  on('#tela-login .auth-form', 'submit', e => {
    e.preventDefault();

    const email = document.querySelector('#tela-login #email')?.value?.trim() || '';
    const senha = document.querySelector('#tela-login #senha')?.value || '';

    if (!email || !senha) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Por favor, insira um email válido.');
      return;
    }

    alert('Login realizado com sucesso!');
    // window.location.href = 'pagina-principal.html';
  });

  // ---- “Esqueci minha senha” → vai para tela de recuperar e-mail ----
  function goToRecover(e) {
    e.preventDefault();
    appState.nextAfterVerify = 'redefinir-senha'; // após verificar código, iremos para redefinir
    mostrarTela('tela-recuperar-senha-email');
  }
  // tenta por ID; se não existir, usa o link com classe .forgot
  if (!on('#esqueci-senha', 'click', goToRecover)) {
    on('#tela-login .forgot', 'click', goToRecover);
  }

  // ---- Botões “Entrar com Google” (login e redefinir) ----
  document.querySelectorAll('.btn.btn-google').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('Redirecionando para autenticação com Google...');
      // Implementa aqui o teu fluxo OAuth
    });
  });

  // ---- Link “Criar Conta” na tela de login (âncora sem id) ----
  on('#tela-login .content a[href="#"]', 'click', e => {
    e.preventDefault();
    mostrarTela('tela-criar-conta');
  });
}


// ===================== ARRANQUE =====================
document.addEventListener('DOMContentLoaded', () => {
  // Evita “flash”: esconde todas as telas até a sequência começar
  document.querySelectorAll('.tela').forEach(t => (t.style.display = 'none'));

  iniciarSequencia();
  configurarBotoes();
});

// (Opcional) expõe também iniciarSequencia/logout globalmente
window.appFlow.iniciarSequencia = iniciarSequencia;
window.appFlow.logout = logout;

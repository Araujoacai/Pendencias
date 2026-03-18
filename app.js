// =====================================================
// app.js — Pendências: Lógica Principal
// Firebase Firestore CRUD + Filtros + PWA
// =====================================================

// ── Estado Global ──────────────────────────────────
const state = {
  pendencias: [],
  filtroCategoria: 'todos',
  filtroStatus: 'todos',
  busca: '',
  idParaExcluir: null,
  deferredPrompt: null
};

// ── Referências do DOM ──────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  tbody: $('pendencias-tbody'),
  loadingState: $('loading-state'),
  emptyState: $('empty-state'),
  tableWrapper: $('table-wrapper'),
  itemCount: $('item-count'),
  sectionTitle: $('section-title'),
  // Stats
  statTotal: $('stat-total'),
  statFamilias: $('stat-familias'),
  statPendentes: $('stat-pendentes'),
  statConcluidos: $('stat-concluidos'),
  statValor: $('stat-valor'),
  // Filtros
  searchInput: $('search-input'),
  filterStatusSelect: $('filter-status-select'),
  // Modal Form
  modalOverlay: $('modal-overlay'),
  modal: $('modal'),
  modalTitle: $('modal-title'),
  pendenciaForm: $('pendencia-form'),
  pendenciaId: $('pendencia-id'),
  inputNome: $('input-nome'),
  inputCategoria: $('input-categoria'),
  inputQuantidade: $('input-quantidade'),
  inputTipo: $('input-tipo'),
  inputStatus: $('input-status'),
  inputFamilia: $('input-familia'),
  inputValor: $('input-valor'),
  inputObs: $('input-obs'),
  // Family Section
  sectionFamilia: $('family-members-section'),
  listFamilia: $('family-members-list'),
  inputNovoFamiliar: $('input-new-family-member'),
  btnAddFamiliar: $('btn-add-family-member'),
  // Confirm Modal
  confirmOverlay: $('confirm-overlay'),
  // PWA
  btnInstall: $('btn-install'),
};

// ── Firebase ────────────────────────────────────────
const db = window.firebaseDB;
const { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } = window.firebaseFns;

const COL = 'pendencias';

// ── Helpers ─────────────────────────────────────────
const formatCurrency = (val) =>
  val ? `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null;

const statusInfo = {
  pendente:  { label: 'Pendente',     dot: true },
  andamento: { label: 'Em andamento', dot: true },
  concluido: { label: 'Concluído',    dot: true },
  pago:      { label: 'Pago',         dot: true },
};

const catInfo = {
  pessoa:    { label: 'Pessoa',    icon: 'fa-user' },
  item:      { label: 'Item',      icon: 'fa-box' },
  comida:    { label: 'Comida',    icon: 'fa-utensils' },
  decoracao: { label: 'Decoração', icon: 'fa-wand-magic-sparkles' },
};

const catTitles = {
  todos:     'Todas as Pendências',
  pessoa:    'Pessoas',
  item:      'Itens / Compras',
  comida:    'Comidas',
  decoracao: 'Decoração',
};

// ── Toast ────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Render ───────────────────────────────────────────
function filtrarPendencias() {
  return state.pendencias.filter((p) => {
    const matchCat = state.filtroCategoria === 'todos' || p.categoria === state.filtroCategoria;
    const matchStatus = state.filtroStatus === 'todos' || p.status === state.filtroStatus;
    const matchBusca = !state.busca ||
      p.nome?.toLowerCase().includes(state.busca) ||
      p.observacao?.toLowerCase().includes(state.busca);
    return matchCat && matchStatus && matchBusca;
  });
}

function renderStats() {
  const total = state.pendencias.length;
  const familias = new Set(state.pendencias.filter(p => p.familia).map(p => p.familia)).size;
  const pendentes = state.pendencias.filter(p => p.status === 'pendente').length;
  const concluidos = state.pendencias.filter(p => ['concluido', 'pago'].includes(p.status)).length;
  const valor = state.pendencias.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

  animNumber(els.statTotal, total);
  animNumber(els.statFamilias, familias);
  animNumber(els.statPendentes, pendentes);
  animNumber(els.statConcluidos, concluidos);
  els.statValor.textContent = `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function animNumber(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const diff = target - current;
  const step = Math.ceil(Math.abs(diff) / 8);
  const dir = diff > 0 ? 1 : -1;
  let val = current;
  const interval = setInterval(() => {
    val = Math.min(Math.max(val + dir * step, Math.min(current, target)), Math.max(current, target));
    el.textContent = val;
    if (val === target) clearInterval(interval);
  }, 40);
}

function renderTabela() {
  const lista = filtrarPendencias();

  els.tableWrapper.style.display = 'none';
  els.emptyState.style.display = 'none';

  els.sectionTitle.textContent = catTitles[state.filtroCategoria] || 'Todas as Pendências';
  els.itemCount.textContent = `${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`;

  if (lista.length === 0) {
    els.emptyState.style.display = 'flex';
    return;
  }

  els.tableWrapper.style.display = 'block';
  els.tbody.innerHTML = '';

  lista.forEach((p) => {
    const cat = catInfo[p.categoria] || { label: p.categoria, icon: 'fa-circle' };
    const statusClass = `status-${p.status}`;
    const statusLabel = statusInfo[p.status]?.label || p.status;
    const valorFmt = formatCurrency(p.valor);
    const qtdTipo = [p.quantidade, p.tipo].filter(Boolean).join(' ');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="cell-nome">${escapeHtml(p.nome)}</div>
        ${p.observacao ? `<div class="cell-obs">${escapeHtml(p.observacao)}</div>` : ''}
      </td>
      <td>
        ${p.familia
          ? `<span class="familia-badge"><i class="fa-solid fa-people-roof"></i> ${p.familia}</span>`
          : `<span style="color:var(--text-muted)">—</span>`
        }
      </td>
      <td>
        <span class="cat-badge cat-${p.categoria}">
          <i class="fa-solid ${cat.icon}"></i> ${cat.label}
        </span>
      </td>
      <td class="td-tipo">${escapeHtml(qtdTipo) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <button class="status-badge ${statusClass}" data-id="${p.id}" onclick="cycleStatus('${p.id}', '${p.status}')" title="Clique para alterar status">
          <span class="status-dot"></span>
          ${statusLabel}
        </button>
      </td>
      <td>
        ${valorFmt
          ? `<span class="cell-valor">${valorFmt}</span>`
          : `<span class="cell-valor sem-valor">—</span>`
        }
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn-action edit" onclick="openEdit('${p.id}')" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-action delete" onclick="confirmDelete('${p.id}')" title="Excluir">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    els.tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Firebase: Listener em Tempo Real ─────────────────
function initFirestore() {
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'));

  onSnapshot(q, (snapshot) => {
    els.loadingState.style.display = 'none';

    state.pendencias = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderStats();
    renderTabela();
    
    // Auto-update da lista da familia se o modal estiver aberto focando nela
    if (els.sectionFamilia && els.sectionFamilia.style.display === 'block') {
      const fam = Number(els.inputFamilia.value);
      if (fam && window.renderFamilyMembers) window.renderFamilyMembers(fam);
    }
  }, (err) => {
    console.error('Firestore error:', err);
    els.loadingState.style.display = 'none';
    showToast('Erro ao conectar com o Firebase. Verifique o console.', 'error');
  });
}

// ── CRUD ─────────────────────────────────────────────
async function savePendencia(data) {
  const id = els.pendenciaId.value;
  try {
    if (id) {
      await updateDoc(doc(db, COL, id), { ...data, atualizadoEm: serverTimestamp() });
      showToast('Pendência atualizada com sucesso!', 'success');
    } else {
      await addDoc(collection(db, COL), { ...data, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
      showToast('Pendência adicionada com sucesso!', 'success');
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar pendência.', 'error');
  }
}

async function deletePendencia(id) {
  try {
    await deleteDoc(doc(db, COL, id));
    showToast('Pendência excluída.', 'info');
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir pendência.', 'error');
  }
}

// Cycle de status ao clicar no badge
window.cycleStatus = async function(id, currentStatus) {
  const order = ['pendente', 'andamento', 'concluido', 'pago'];
  const next = order[(order.indexOf(currentStatus) + 1) % order.length];
  try {
    await updateDoc(doc(db, COL, id), { status: next, atualizadoEm: serverTimestamp() });
    showToast(`Status → ${statusInfo[next].label}`, 'info');
  } catch (err) {
    showToast('Erro ao alterar status.', 'error');
  }
};

// ── Modal ─────────────────────────────────────────────
function openModal() {
  els.pendenciaId.value = '';
  els.pendenciaForm.reset();
  if(window.checkFamilySection) window.checkFamilySection();
  els.modalTitle.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Nova Pendência';
  els.modalOverlay.classList.add('active');
  setTimeout(() => els.inputNome.focus(), 50);
}

window.openEdit = function(id) {
  const p = state.pendencias.find((x) => x.id === id);
  if (!p) return;

  els.pendenciaId.value = id;
  els.inputNome.value = p.nome || '';
  els.inputFamilia.value = p.familia || '';
  els.inputCategoria.value = p.categoria || '';
  els.inputQuantidade.value = p.quantidade || '';
  els.inputTipo.value = p.tipo || '';
  els.inputStatus.value = p.status || 'pendente';
  els.inputValor.value = p.valor || '';
  els.inputObs.value = p.observacao || '';

  els.modalTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Pendência';
  
  if(window.checkFamilySection) window.checkFamilySection();
  
  els.modalOverlay.classList.add('active');
};

function closeModal() {
  els.modalOverlay.classList.remove('active');
  els.pendenciaForm.reset();
  els.pendenciaId.value = '';
}

window.confirmDelete = function(id) {
  state.idParaExcluir = id;
  els.confirmOverlay.classList.add('active');
};

function closeConfirm() {
  state.idParaExcluir = null;
  els.confirmOverlay.classList.remove('active');
}

// ── Filtros ───────────────────────────────────────────
function setFiltroCategoria(cat) {
  state.filtroCategoria = cat;
  document.querySelectorAll('.filter-btn').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.filter === cat)
  );
  renderTabela();
}

// ── PWA Install ───────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPrompt = e;
  els.btnInstall.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  els.btnInstall.style.display = 'none';
  showToast('App instalado com sucesso! 🎉', 'success');
});

// ── Service Worker ────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.log('[SW] Service Worker registrado'))
      .catch((err) => console.warn('[SW] Falha no registro:', err));
  });
}

// ── Online/Offline ────────────────────────────────────
function updateOnlineStatus() {
  const badge = $('online-status');
  if (navigator.onLine) {
    badge.innerHTML = '<span class="pulse-dot"></span><span>Online</span>';
    badge.style.background = 'rgba(34,197,94,0.1)';
    badge.style.borderColor = 'rgba(34,197,94,0.2)';
    badge.style.color = '#22c55e';
  } else {
    badge.innerHTML = '<span class="pulse-dot" style="background:#ef4444;animation:none"></span><span>Offline</span>';
    badge.style.background = 'rgba(239,68,68,0.1)';
    badge.style.borderColor = 'rgba(239,68,68,0.2)';
    badge.style.color = '#ef4444';
  }
}

// ── Event Listeners ───────────────────────────────────
function bindEvents() {
  // Abrir modal
  $('btn-add').addEventListener('click', openModal);
  $('modal-close').addEventListener('click', closeModal);
  $('btn-cancel').addEventListener('click', closeModal);

  // Fechar clicando fora do modal
  els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });

  // Submit form
  els.pendenciaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = $('btn-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    await savePendencia({
      nome: els.inputNome.value.trim(),
      familia: els.inputFamilia.value ? Number(els.inputFamilia.value) : null,
      categoria: els.inputCategoria.value,
      quantidade: els.inputQuantidade.value ? Number(els.inputQuantidade.value) : null,
      tipo: els.inputTipo.value.trim() || null,
      status: els.inputStatus.value,
      valor: els.inputValor.value ? Number(els.inputValor.value) : null,
      observacao: els.inputObs.value.trim() || null,
    });

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
  });

  // Filtros de categoria
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setFiltroCategoria(btn.dataset.filter));
  });

  // Busca
  els.searchInput.addEventListener('input', (e) => {
    state.busca = e.target.value.toLowerCase();
    renderTabela();
  });

  // Filtro de status
  els.filterStatusSelect.addEventListener('change', (e) => {
    state.filtroStatus = e.target.value;
    renderTabela();
  });

  // Delete confirm
  $('confirm-delete').addEventListener('click', async () => {
    if (state.idParaExcluir) {
      await deletePendencia(state.idParaExcluir);
      closeConfirm();
    }
  });

  $('confirm-cancel').addEventListener('click', closeConfirm);
  els.confirmOverlay.addEventListener('click', (e) => {
    if (e.target === els.confirmOverlay) closeConfirm();
  });

  // ========== LÓGICA MEMBROS DA FAMÍLIA RAPIDO ==========
  window.checkFamilySection = function() {
    const cat = els.inputCategoria.value;
    const famStr = els.inputFamilia.value;
    const fam = Number(famStr);
    
    if (cat === 'pessoa' && famStr && fam > 0) {
      els.sectionFamilia.style.display = 'block';
      window.renderFamilyMembers(fam);
    } else {
      els.sectionFamilia.style.display = 'none';
      els.listFamilia.innerHTML = '';
    }
  };

  els.inputCategoria.addEventListener('change', window.checkFamilySection);
  els.inputFamilia.addEventListener('input', window.checkFamilySection);

  window.renderFamilyMembers = function(famNumber) {
    const members = state.pendencias.filter(p => p.categoria === 'pessoa' && p.familia === famNumber);
    els.listFamilia.innerHTML = '';
    
    if (members.length === 0) {
      els.listFamilia.innerHTML = '<li class="family-empty" style="font-size:12px; color:var(--text-muted); padding:4px;">Família nova. Adicione membros!</li>';
      return;
    }

    members.forEach(m => {
      const li = document.createElement('li');
      li.className = 'family-list-item';
      li.innerHTML = `
        <span><i class="fa-solid fa-user-check" style="color:var(--purple); margin-right:6px;"></i> <strong>${escapeHtml(m.nome)}</strong></span>
        <span class="status-badge status-${m.status}" style="font-size:10px; padding:2px 8px;">${statusInfo[m.status]?.label || m.status}</span>
      `;
      els.listFamilia.appendChild(li);
    });
  };

  els.btnAddFamiliar.addEventListener('click', async () => {
    const nome = els.inputNovoFamiliar.value.trim();
    const fam = Number(els.inputFamilia.value);
    
    if (!nome) return;
    
    els.btnAddFamiliar.disabled = true;
    els.btnAddFamiliar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      await addDoc(collection(db, COL), {
        nome: nome,
        categoria: 'pessoa',
        familia: fam,
        quantidade: null,
        tipo: null,
        status: 'pendente',
        valor: null,
        observacao: null,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      showToast('Familiar cadastrado rapidamente!', 'success');
      els.inputNovoFamiliar.value = '';
    } catch (e) {
      console.error(e);
      showToast('Erro ao inserir rápido', 'error');
    }
    
    els.btnAddFamiliar.disabled = false;
    els.btnAddFamiliar.innerHTML = '<i class="fa-solid fa-plus"></i> Add';
  });
  
  // Quando o inputNovoFamiliar der ENTER, clica no add
  els.inputNovoFamiliar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      els.btnAddFamiliar.click();
    }
  });
  // =======================================================

  // PWA Install
  els.btnInstall.addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('Instalando app...', 'info');
    state.deferredPrompt = null;
    els.btnInstall.style.display = 'none';
  });

  // Online / Offline
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// ── Inicialização ─────────────────────────────────────
(function init() {
  bindEvents();
  initFirestore();
})();

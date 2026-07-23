// ============================================
// FROTA PRO - GOOGLE SHEETS EDITION
// ============================================

// ============================================
// CAMADA DE API - GOOGLE SHEETS
// ============================================
const API = {
    isLoading: false,
    
    async fetchSheet(sheet) {
        const url = `${CONFIG.API_URL}?sheet=${sheet}`;
        try {
            const res = await fetch(url, { method: 'GET' });
            const json = await res.json();
            if (json.success) return json.data || [];
            throw new Error(json.error);
        } catch (err) {
            console.error(`Erro ao carregar ${sheet}:`, err);
            // Fallback: tenta usar cache local
            return this.getCache(sheet) || [];
        }
    },
    
    async post(action, sheet, data) {
        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({ action, sheet, ...data }),
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            return json;
        } catch (err) {
            console.error(`Erro em ${action} ${sheet}:`, err);
            // Fallback: salva localmente para sincronizar depois
            this.queueOffline(action, sheet, data);
            throw err;
        }
    },
    
    async insert(sheet, record) {
        return this.post('insert', sheet, { data: record });
    },
    
    async update(sheet, id, record) {
        return this.post('update', sheet, { id, data: record });
    },
    
    async remove(sheet, id) {
        return this.post('delete', sheet, { id });
    },
    
    async batchInsert(sheet, rows) {
        return this.post('batchInsert', sheet, { rows });
    },
    
    // Cache local para fallback offline
    getCache(sheet) {
        try {
            const cache = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || '{}');
            return cache[sheet] || null;
        } catch (e) { return null; }
    },
    
    setCache(sheet, data) {
        try {
            const cache = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || '{}');
            cache[sheet] = data;
            cache._timestamp = Date.now();
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cache));
        } catch (e) {}
    },
    
    queueOffline(action, sheet, data) {
        try {
            const queue = JSON.parse(localStorage.getItem('frotaPro_queue') || '[]');
            queue.push({ action, sheet, data, timestamp: Date.now() });
            localStorage.setItem('frotaPro_queue', JSON.stringify(queue));
        } catch (e) {}
    },
    
    clearQueue() {
        localStorage.removeItem('frotaPro_queue');
    }
};

// ============================================
// UTILS
// ============================================
const generateId = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
const formatDate = (d) => new Date(d).toISOString().split('T')[0];
const formatDateBR = (d) => {
    if (!d) return '--/--/----';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'); } catch (e) { return d; }
};
const formatCurrency = (v) => {
    const n = parseFloat(v) || 0;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const formatNumber = (v) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const formatKm = (v) => formatNumber(v) + ' km';

// ============================================
// APP CORE
// ============================================
const App = {
    data: { Veiculos: [], Quilometragem: [], Abastecimento: [], Manutencao: [], Cronograma: [] },
    currentScreen: 'dashboard',
    darkMode: false,
    
    async init() {
        this.setupEventListeners();
        this.applyTheme();
        this.showLoading('Carregando dados do Google Sheets...');
        
        try {
            await this.loadAllData();
            this.hideLoading();
            this.navigate('dashboard');
        } catch (err) {
            this.hideLoading();
            this.showToast('Erro ao carregar dados. Usando cache local.', 'error');
            // Carrega do cache local se existir
            const sheets = ['Veiculos', 'Quilometragem', 'Abastecimento', 'Manutencao', 'Cronograma'];
            sheets.forEach(s => {
                const cached = API.getCache(s);
                if (cached) this.data[s] = cached;
            });
            this.navigate('dashboard');
        }
    },
    
    showLoading(msg) {
        let el = document.getElementById('globalLoading');
        if (!el) {
            el = document.createElement('div');
            el.id = 'globalLoading';
            el.innerHTML = `
                <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;">
                    <div style="width:50px;height:50px;border:4px solid rgba(255,255,255,0.2);border-top-color:#00e5ff;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:15px;"></div>
                    <p style="color:white;font-size:14px;font-weight:600;">${msg}</p>
                </div>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            `;
            document.body.appendChild(el);
        }
        el.style.display = 'flex';
    },
    
    hideLoading() {
        const el = document.getElementById('globalLoading');
        if (el) el.style.display = 'none';
    },
    
    async loadAllData() {
        const sheets = ['Veiculos', 'Quilometragem', 'Abastecimento', 'Manutencao', 'Cronograma'];
        const results = await Promise.all(sheets.map(s => API.fetchSheet(s)));
        sheets.forEach((s, i) => {
            this.data[s] = results[i] || [];
            API.setCache(s, this.data[s]);
        });
    },
    
    setupEventListeners() {
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const screen = item.dataset.screen;
                if (screen) {
                    this.navigate(screen);
                    if (window.innerWidth < 768) {
                        document.getElementById('sidebar').classList.add('collapsed');
                    }
                }
            });
        });
        
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.darkMode = !this.darkMode;
            this.applyTheme();
        });
        
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeAllModals();
            });
        });
        
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.openModal(btn.dataset.modal);
            });
        });
        
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        
        // Busca
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.renderSearchResults(e.target.value);
        });
        
        document.getElementById('searchInput').addEventListener('focus', () => {
            document.getElementById('searchResults').classList.add('active');
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box')) {
                document.getElementById('searchResults').classList.remove('active');
            }
        });
    },
    
    applyTheme() {
        document.body.classList.toggle('dark-mode', this.darkMode);
        const icon = document.querySelector('#themeToggle i');
        icon.className = this.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    },
    
    navigate(screen) {
        this.currentScreen = screen;
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screen);
        });
        
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`screen-${screen}`);
        if (target) {
            target.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        this.renderScreen(screen);
        this.updatePageTitle(screen);
    },
    
    updatePageTitle(screen) {
        const titles = {
            dashboard: 'Dashboard',
            veiculos: 'Veiculos',
            quilometragem: 'Quilometragem',
            abastecimento: 'Abastecimento',
            manutencao: 'Manutencao',
            cronograma: 'Cronograma',
            relatorios: 'Relatorios'
        };
        document.getElementById('pageTitle').textContent = titles[screen] || 'Frota Pro';
    },
    
    renderScreen(screen) {
        switch (screen) {
            case 'dashboard': this.renderDashboard(); break;
            case 'veiculos': this.renderVeiculos(); break;
            case 'quilometragem': this.renderQuilometragem(); break;
            case 'abastecimento': this.renderAbastecimento(); break;
            case 'manutencao': this.renderManutencao(); break;
            case 'cronograma': this.renderCronograma(); break;
            case 'relatorios': this.renderRelatorios(); break;
        }
    },
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Populate selects
            if (modalId.includes('veiculo') && !modalId.includes('list')) {
                this.populateVeiculoSelects(modal.querySelectorAll('select[name="veiculoId"]'));
            }
            
            // Pre-fill date
            const dateInput = modal.querySelector('input[type="date"]');
            if (dateInput && !dateInput.value) {
                dateInput.value = formatDate(new Date());
            }
            
            // Reset form if adding new
            if (!modal.dataset.editId) {
                const form = modal.querySelector('form');
                if (form) form.reset();
            }
        }
    },
    
    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('active');
            delete m.dataset.editId;
        });
        document.body.style.overflow = '';
        document.querySelectorAll('.modal form').forEach(f => f.reset());
    },
    
    populateVeiculoSelects(selects) {
        const veiculos = this.data.Veiculos;
        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Selecione o veiculo</option>' +
                veiculos.map(v => `<option value="${v.id}">${v.grupo} - ${v.placa} (${v.marca} ${v.modelo})</option>`).join('');
            if (currentVal) select.value = currentVal;
        });
    },
    
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('show'));
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    // ============================================
    // SEARCH
    // ============================================
    renderSearchResults(query) {
        const container = document.getElementById('searchResults');
        if (!query || query.length < 2) {
            container.innerHTML = '';
            return;
        }
        
        const q = query.toLowerCase();
        const results = [];
        
        this.data.Veiculos.forEach(v => {
            if (v.placa?.toLowerCase().includes(q) || v.marca?.toLowerCase().includes(q) || v.modelo?.toLowerCase().includes(q)) {
                results.push({ type: 'Veiculo', text: `${v.placa} - ${v.marca} ${v.modelo}`, screen: 'veiculos' });
            }
        });
        
        this.data.Manutencao.forEach(m => {
            const v = this.data.Veiculos.find(v => v.id === m.veiculoId);
            if (m.servico?.toLowerCase().includes(q)) {
                results.push({ type: 'Manutencao', text: `${m.servico}${v ? ' - ' + v.placa : ''}`, screen: 'manutencao' });
            }
        });
        
        if (results.length === 0) {
            container.innerHTML = '<div class="search-no-results">Nenhum resultado encontrado</div>';
        } else {
            container.innerHTML = results.slice(0, 8).map(r => `
                <div class="search-result-item" onclick="App.navigate('${r.screen}'); document.getElementById('searchResults').classList.remove('active'); document.getElementById('searchInput').value = '';">
                    <span class="search-result-type">${r.type}</span>
                    <span class="search-result-text">${r.text}</span>
                </div>
            `).join('');
        }
    },
    
    // ============================================
    // DASHBOARD
    // ============================================
    renderDashboard() {
        const veiculos = this.data.Veiculos;
        const totalVeiculos = veiculos.length;
        const ativos = veiculos.filter(v => v.status === 'Ativo').length;
        const inativos = veiculos.filter(v => v.status === 'Inativo').length;
        const emManutencao = veiculos.filter(v => v.status === 'Em Manutencao').length;
        
        document.getElementById('totalVeiculos').textContent = totalVeiculos;
        document.getElementById('veiculosAtivos').textContent = ativos;
        document.getElementById('veiculosInativos').textContent = inativos;
        document.getElementById('emManutencao').textContent = emManutencao;
        
        // KM rodado mes
        const mesAtual = new Date().getMonth();
        const anoAtual = new Date().getFullYear();
        const kmMes = this.data.Quilometragem.filter(q => {
            const d = new Date(q.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        }).reduce((sum, q) => sum + (parseFloat(q.kmAtual) || 0), 0);
        document.getElementById('kmRodadoMes').textContent = formatKm(kmMes);
        
        // Consumo medio
        const abastMes = this.data.Abastecimento.filter(a => {
            const d = new Date(a.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        });
        const totalLitros = abastMes.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0);
        const totalValor = abastMes.reduce((s, a) => s + (parseFloat(a.valorTotal) || 0), 0);
        const consumoMedio = totalLitros > 0 ? totalValor / totalLitros : 0;
        document.getElementById('consumoMedio').textContent = 'R$ ' + consumoMedio.toFixed(2) + '/L';
        
        // Custo manutencao mes
        const manutMes = this.data.Manutencao.filter(m => {
            const d = new Date(m.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual && m.status === 'Concluido';
        }).reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
        document.getElementById('custoManutencao').textContent = formatCurrency(manutMes);
        
        // Alertas
        this.renderAlertas();
        
        // Graficos
        this.renderGraficosDashboard();
    },
    
    renderAlertas() {
        const alertas = [];
        const hoje = new Date();
        const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        this.data.Veiculos.forEach(v => {
            if (v.vencLicenciamento) {
                const venc = new Date(v.vencLicenciamento + 'T00:00:00');
                const dias = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
                if (dias <= 30 && dias >= 0) {
                    alertas.push({ tipo: 'licenciamento', texto: `Licenciamento ${v.placa} vence em ${dias} dias`, cor: dias <= 7 ? 'red' : 'yellow' });
                } else if (dias < 0) {
                    alertas.push({ tipo: 'licenciamento', texto: `Licenciamento ${v.placa} VENCIDO`, cor: 'red' });
                }
            }
        });
        
        this.data.Manutencao.filter(m => m.status === 'Pendente').forEach(m => {
            const v = this.data.Veiculos.find(v => v.id === m.veiculoId);
            alertas.push({ tipo: 'manutencao', texto: `Manutencao pendente: ${m.servico}${v ? ' - ' + v.placa : ''}`, cor: 'yellow' });
        });
        
        const container = document.getElementById('alertasList');
        if (alertas.length === 0) {
            container.innerHTML = '<div class="alerta-item" style="border-left-color: var(--success-color);"><i class="fas fa-check-circle" style="color: var(--success-color);"></i><div class="alerta-texto">Nenhum alerta no momento. Tudo em ordem!</div></div>';
        } else {
            container.innerHTML = alertas.map(a => `
                <div class="alerta-item" style="border-left-color: var(--${a.cor === 'red' ? 'danger' : 'warning'}-color);">
                    <i class="fas fa-${a.tipo === 'seguro' ? 'shield-alt' : a.tipo === 'licenciamento' ? 'id-card' : 'wrench'}" style="color: var(--${a.cor === 'red' ? 'danger' : 'warning'}-color);"></i>
                    <div class="alerta-texto">${a.texto}</div>
                </div>
            `).join('');
        }
    },
    
    renderGraficosDashboard() {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const anoAtual = new Date().getFullYear();
        
        // Grafico de custos
        const custos = meses.map((_, i) => {
            return this.data.Abastecimento.filter(a => {
                const d = new Date(a.data + 'T00:00:00');
                return d.getMonth() === i && d.getFullYear() === anoAtual;
            }).reduce((s, a) => s + (parseFloat(a.valorTotal) || 0), 0);
        });
        
        const ctxCusto = document.getElementById('chartCustoMensal');
        if (window.chartCusto) window.chartCusto.destroy();
        window.chartCusto = new Chart(ctxCusto, {
            type: 'bar',
            data: {
                labels: meses,
                datasets: [{
                    label: 'Custo Abastecimento',
                    data: custos,
                    backgroundColor: 'rgba(41, 98, 255, 0.7)',
                    borderColor: '#2962ff',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
            }
        });
        
        // Grafico de status
        const statusCounts = {};
        this.data.Veiculos.forEach(v => { statusCounts[v.status] = (statusCounts[v.status] || 0) + 1; });
        
        const ctxStatus = document.getElementById('chartStatusVeiculos');
        if (window.chartStatus) window.chartStatus.destroy();
        window.chartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: ['#00c853', '#ffab00', '#ff3d00', '#2962ff'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 15 } } },
                cutout: '65%'
            }
        });
    },
    
    // ============================================
    // VEICULOS
    // ============================================
    renderVeiculos() {
        const grid = document.getElementById('veiculosGrid');
        const veiculos = this.data.Veiculos;
        
        if (veiculos.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-icon"><i class="fas fa-truck"></i></div>
                    <div class="empty-state-text">Nenhum veiculo cadastrado</div>
                    <div class="empty-state-subtext">Clique em "+ Novo Veiculo" para comecar</div>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = veiculos.map(v => {
            const statusClass = v.status === 'Ativo' ? 'status-ativo' : v.status === 'Inativo' ? 'status-inativo' : 'status-manutencao';
            return `
                <div class="veiculo-card" data-id="${v.id}">
                    <div class="veiculo-header">
                        <span class="veiculo-grupo">${v.grupo || 'Sem grupo'}</span>
                        <span class="veiculo-status ${statusClass}">${v.status}</span>
                    </div>
                    <div class="veiculo-placa">${v.placa}</div>
                    <div class="veiculo-info">${v.marca} ${v.modelo} ${v.ano}</div>
                    <div class="veiculo-detalhes">
                        <div class="veiculo-detalhe"><span>Combustivel</span><strong>${v.combustivel}</strong></div>
                        <div class="veiculo-detalhe"><span>Licenciamento</span><strong>${formatDateBR(v.vencLicenciamento)}</strong></div>
                    </div>
                    <div class="veiculo-acoes">
                        <button class="btn-icon" onclick="App.editVeiculo('${v.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="App.deleteVeiculo('${v.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    async saveVeiculo(formData) {
        const isEdit = !!formData.id;
        const record = {
            id: formData.id || generateId(),
            grupo: formData.grupo,
            placa: formData.placa.toUpperCase(),
            marca: formData.marca,
            modelo: formData.modelo,
            ano: formData.ano,
            combustivel: formData.combustivel,
            vencLicenciamento: formData.vencLicenciamento,
            origem: formData.origem,
            status: formData.status
        };
        
        this.showLoading(isEdit ? 'Atualizando veiculo...' : 'Salvando veiculo...');
        
        try {
            if (isEdit) {
                await API.update('Veiculos', record.id, record);
                const idx = this.data.Veiculos.findIndex(v => v.id === record.id);
                if (idx >= 0) this.data.Veiculos[idx] = record;
            } else {
                await API.insert('Veiculos', record);
                this.data.Veiculos.push(record);
            }
            
            API.setCache('Veiculos', this.data.Veiculos);
            this.hideLoading();
            this.closeAllModals();
            this.renderVeiculos();
            this.showToast(isEdit ? 'Veiculo atualizado!' : 'Veiculo cadastrado!');
        } catch (err) {
            this.hideLoading();
            // Atualiza localmente mesmo se a API falhar (modo offline)
            if (isEdit) {
                const idx = this.data.Veiculos.findIndex(v => v.id === record.id);
                if (idx >= 0) this.data.Veiculos[idx] = record;
            } else {
                this.data.Veiculos.push(record);
            }
            API.setCache('Veiculos', this.data.Veiculos);
            this.closeAllModals();
            this.renderVeiculos();
            this.showToast('Salvo localmente. Sincronizara quando online.', 'warning');
        }
    },
    
    editVeiculo(id) {
        const v = this.data.Veiculos.find(x => x.id === id);
        if (!v) return;
        
        const modal = document.getElementById('modal-veiculo');
        modal.dataset.editId = id;
        
        const fields = ['grupo', 'placa', 'marca', 'modelo', 'ano', 'combustivel', 'vencLicenciamento', 'origem', 'status'];
        fields.forEach(f => {
            const el = modal.querySelector(`[name="${f}"]`);
            if (el) el.value = v[f] || '';
        });
        
        this.openModal('modal-veiculo');
    },
    
    async deleteVeiculo(id) {
        if (!confirm('Tem certeza que deseja excluir este veiculo?')) return;
        
        this.showLoading('Excluindo...');
        try {
            await API.remove('Veiculos', id);
            this.data.Veiculos = this.data.Veiculos.filter(v => v.id !== id);
            API.setCache('Veiculos', this.data.Veiculos);
            this.hideLoading();
            this.renderVeiculos();
            this.showToast('Veiculo excluido!');
        } catch (err) {
            this.hideLoading();
            this.data.Veiculos = this.data.Veiculos.filter(v => v.id !== id);
            API.setCache('Veiculos', this.data.Veiculos);
            this.renderVeiculos();
            this.showToast('Excluido localmente. Sincronizara quando online.', 'warning');
        }
    },
    
    // ============================================
    // QUILOMETRAGEM
    // ============================================
    renderQuilometragem() {
        const tbody = document.getElementById('quilometragemTableBody');
        const registros = [...this.data.Quilometragem].sort((a, b) => new Date(b.data + 'T' + (b.hora || '00:00')) - new Date(a.data + 'T' + (a.hora || '00:00')));
        
        if (registros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-secondary);">Nenhum registro de quilometragem</td></tr>`;
            return;
        }
        
        tbody.innerHTML = registros.map(r => {
            const v = this.data.Veiculos.find(x => x.id === r.veiculoId);
            return `
                <tr>
                    <td>${formatDateBR(r.data)} ${r.hora || ''}</td>
                    <td><strong>${v?.placa || 'N/A'}</strong><br><small>${v?.marca || ''} ${v?.modelo || ''}</small></td>
                    <td>${r.motorista || '-'}</td>
                    <td>${formatKm(r.kmAtual)}</td>
                    <td>${r.obs || '-'}</td>
                    <td>
                        <button class="btn-icon" onclick="App.editQuilometragem('${r.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="App.deleteQuilometragem('${r.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async saveQuilometragem(formData) {
        const isEdit = !!formData.id;
        const record = {
            id: formData.id || generateId(),
            data: formData.data,
            hora: formData.hora,
            veiculoId: formData.veiculoId,
            grupo: formData.grupo,
            placa: formData.placa?.toUpperCase() || '',
            motorista: formData.motorista,
            kmAtual: formData.kmAtual,
            obs: formData.obs
        };
        
        this.showLoading(isEdit ? 'Atualizando...' : 'Salvando...');
        
        try {
            if (isEdit) {
                await API.update('Quilometragem', record.id, record);
                const idx = this.data.Quilometragem.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Quilometragem[idx] = record;
            } else {
                await API.insert('Quilometragem', record);
                this.data.Quilometragem.push(record);
            }
            
            API.setCache('Quilometragem', this.data.Quilometragem);
            this.hideLoading();
            this.closeAllModals();
            this.renderQuilometragem();
            this.showToast(isEdit ? 'Atualizado!' : 'Registrado!');
        } catch (err) {
            this.hideLoading();
            if (isEdit) {
                const idx = this.data.Quilometragem.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Quilometragem[idx] = record;
            } else {
                this.data.Quilometragem.push(record);
            }
            API.setCache('Quilometragem', this.data.Quilometragem);
            this.closeAllModals();
            this.renderQuilometragem();
            this.showToast('Salvo localmente.', 'warning');
        }
    },
    
    editQuilometragem(id) {
        const r = this.data.Quilometragem.find(x => x.id === id);
        if (!r) return;
        const modal = document.getElementById('modal-quilometragem');
        modal.dataset.editId = id;
        ['data', 'hora', 'veiculoId', 'grupo', 'placa', 'motorista', 'kmAtual', 'obs'].forEach(f => {
            const el = modal.querySelector(`[name="${f}"]`);
            if (el) el.value = r[f] || '';
        });
        this.openModal('modal-quilometragem');
    },
    
    async deleteQuilometragem(id) {
        if (!confirm('Excluir este registro?')) return;
        this.showLoading('Excluindo...');
        try {
            await API.remove('Quilometragem', id);
            this.data.Quilometragem = this.data.Quilometragem.filter(x => x.id !== id);
            API.setCache('Quilometragem', this.data.Quilometragem);
            this.hideLoading();
            this.renderQuilometragem();
            this.showToast('Excluido!');
        } catch (err) {
            this.hideLoading();
            this.data.Quilometragem = this.data.Quilometragem.filter(x => x.id !== id);
            API.setCache('Quilometragem', this.data.Quilometragem);
            this.renderQuilometragem();
            this.showToast('Excluido localmente.', 'warning');
        }
    },
    
    fillQuilometragemFromVeiculo(select) {
        const veiculo = this.data.Veiculos.find(v => v.id === select.value);
        const form = select.closest('form');
        if (veiculo && form) {
            form.querySelector('[name="grupo"]').value = veiculo.grupo || '';
            form.querySelector('[name="placa"]').value = veiculo.placa || '';
        }
    },
    
    // ============================================
    // ABASTECIMENTO
    // ============================================
    renderAbastecimento() {
        const tbody = document.getElementById('abastecimentoTableBody');
        const registros = [...this.data.Abastecimento].sort((a, b) => new Date(b.data + 'T00:00:00') - new Date(a.data + 'T00:00:00'));
        
        if (registros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary);">Nenhum registro de abastecimento</td></tr>`;
            return;
        }
        
        tbody.innerHTML = registros.map(r => {
            const v = this.data.Veiculos.find(x => x.id === r.veiculoId);
            return `
                <tr>
                    <td>${formatDateBR(r.data)}</td>
                    <td><strong>${v?.placa || 'N/A'}</strong></td>
                    <td>${formatNumber(r.litros)} L</td>
                    <td>${formatCurrency(r.valorTotal)}</td>
                    <td>${formatCurrency(r.valorLitro)}</td>
                    <td>${formatKm(r.kmAtual)}</td>
                    <td>
                        <button class="btn-icon" onclick="App.editAbastecimento('${r.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="App.deleteAbastecimento('${r.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async saveAbastecimento(formData) {
        const isEdit = !!formData.id;
        const record = {
            id: formData.id || generateId(),
            data: formData.data,
            veiculoId: formData.veiculoId,
            litros: formData.litros,
            valorTotal: formData.valorTotal,
            valorLitro: formData.valorLitro,
            kmAtual: formData.kmAtual,
            combustivel: formData.combustivel,
            posto: formData.posto
        };
        
        this.showLoading(isEdit ? 'Atualizando...' : 'Salvando...');
        
        try {
            if (isEdit) {
                await API.update('Abastecimento', record.id, record);
                const idx = this.data.Abastecimento.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Abastecimento[idx] = record;
            } else {
                await API.insert('Abastecimento', record);
                this.data.Abastecimento.push(record);
            }
            
            API.setCache('Abastecimento', this.data.Abastecimento);
            this.hideLoading();
            this.closeAllModals();
            this.renderAbastecimento();
            this.showToast(isEdit ? 'Atualizado!' : 'Registrado!');
        } catch (err) {
            this.hideLoading();
            if (isEdit) {
                const idx = this.data.Abastecimento.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Abastecimento[idx] = record;
            } else {
                this.data.Abastecimento.push(record);
            }
            API.setCache('Abastecimento', this.data.Abastecimento);
            this.closeAllModals();
            this.renderAbastecimento();
            this.showToast('Salvo localmente.', 'warning');
        }
    },
    
    editAbastecimento(id) {
        const r = this.data.Abastecimento.find(x => x.id === id);
        if (!r) return;
        const modal = document.getElementById('modal-abastecimento');
        modal.dataset.editId = id;
        ['data', 'veiculoId', 'litros', 'valorTotal', 'valorLitro', 'kmAtual', 'combustivel', 'posto'].forEach(f => {
            const el = modal.querySelector(`[name="${f}"]`);
            if (el) el.value = r[f] || '';
        });
        this.openModal('modal-abastecimento');
    },
    
    async deleteAbastecimento(id) {
        if (!confirm('Excluir este registro?')) return;
        this.showLoading('Excluindo...');
        try {
            await API.remove('Abastecimento', id);
            this.data.Abastecimento = this.data.Abastecimento.filter(x => x.id !== id);
            API.setCache('Abastecimento', this.data.Abastecimento);
            this.hideLoading();
            this.renderAbastecimento();
            this.showToast('Excluido!');
        } catch (err) {
            this.hideLoading();
            this.data.Abastecimento = this.data.Abastecimento.filter(x => x.id !== id);
            API.setCache('Abastecimento', this.data.Abastecimento);
            this.renderAbastecimento();
            this.showToast('Excluido localmente.', 'warning');
        }
    },
    
    fillAbastecimentoFromVeiculo(select) {
        const veiculo = this.data.Veiculos.find(v => v.id === select.value);
        const form = select.closest('form');
        if (veiculo && form) {
            form.querySelector('[name="combustivel"]').value = veiculo.combustivel || '';
        }
    },
    
    calcValorLitro(input) {
        const form = input.closest('form');
        const litros = parseFloat(form.querySelector('[name="litros"]').value) || 0;
        const total = parseFloat(form.querySelector('[name="valorTotal"]').value) || 0;
        if (litros > 0) {
            form.querySelector('[name="valorLitro"]').value = (total / litros).toFixed(3);
        }
    },
    
    // ============================================
    // MANUTENCAO
    // ============================================
    renderManutencao() {
        const tbody = document.getElementById('manutencaoTableBody');
        const registros = [...this.data.Manutencao].sort((a, b) => new Date(b.data + 'T00:00:00') - new Date(a.data + 'T00:00:00'));
        
        if (registros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary);">Nenhum registro de manutencao</td></tr>`;
            return;
        }
        
        tbody.innerHTML = registros.map(r => {
            const v = this.data.Veiculos.find(x => x.id === r.veiculoId);
            const statusClass = r.status === 'Concluido' ? 'status-ativo' : r.status === 'Pendente' ? 'status-manutencao' : 'status-inativo';
            return `
                <tr>
                    <td>${formatDateBR(r.data)}</td>
                    <td><strong>${v?.placa || 'N/A'}</strong></td>
                    <td>${r.tipo}</td>
                    <td>${r.servico}</td>
                    <td>${formatCurrency(r.custo)}</td>
                    <td><span class="veiculo-status ${statusClass}">${r.status}</span></td>
                    <td>
                        <button class="btn-icon" onclick="App.editManutencao('${r.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="App.deleteManutencao('${r.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async saveManutencao(formData) {
        const isEdit = !!formData.id;
        const record = {
            id: formData.id || generateId(),
            data: formData.data,
            veiculoId: formData.veiculoId,
            tipo: formData.tipo,
            servico: formData.servico,
            custo: formData.custo,
            kmManutencao: formData.kmManutencao,
            status: formData.status,
            descricao: formData.descricao
        };
        
        this.showLoading(isEdit ? 'Atualizando...' : 'Salvando...');
        
        try {
            if (isEdit) {
                await API.update('Manutencao', record.id, record);
                const idx = this.data.Manutencao.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Manutencao[idx] = record;
            } else {
                await API.insert('Manutencao', record);
                this.data.Manutencao.push(record);
            }
            
            API.setCache('Manutencao', this.data.Manutencao);
            this.hideLoading();
            this.closeAllModals();
            this.renderManutencao();
            this.showToast(isEdit ? 'Atualizado!' : 'Registrado!');
        } catch (err) {
            this.hideLoading();
            if (isEdit) {
                const idx = this.data.Manutencao.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Manutencao[idx] = record;
            } else {
                this.data.Manutencao.push(record);
            }
            API.setCache('Manutencao', this.data.Manutencao);
            this.closeAllModals();
            this.renderManutencao();
            this.showToast('Salvo localmente.', 'warning');
        }
    },
    
    editManutencao(id) {
        const r = this.data.Manutencao.find(x => x.id === id);
        if (!r) return;
        const modal = document.getElementById('modal-manutencao');
        modal.dataset.editId = id;
        ['data', 'veiculoId', 'tipo', 'servico', 'custo', 'kmManutencao', 'status', 'descricao'].forEach(f => {
            const el = modal.querySelector(`[name="${f}"]`);
            if (el) el.value = r[f] || '';
        });
        this.openModal('modal-manutencao');
    },
    
    async deleteManutencao(id) {
        if (!confirm('Excluir este registro?')) return;
        this.showLoading('Excluindo...');
        try {
            await API.remove('Manutencao', id);
            this.data.Manutencao = this.data.Manutencao.filter(x => x.id !== id);
            API.setCache('Manutencao', this.data.Manutencao);
            this.hideLoading();
            this.renderManutencao();
            this.showToast('Excluido!');
        } catch (err) {
            this.hideLoading();
            this.data.Manutencao = this.data.Manutencao.filter(x => x.id !== id);
            API.setCache('Manutencao', this.data.Manutencao);
            this.renderManutencao();
            this.showToast('Excluido localmente.', 'warning');
        }
    },
    
    // ============================================
    // CRONOGRAMA
    // ============================================
    renderCronograma() {
        const tbody = document.getElementById('cronogramaTableBody');
        const registros = [...this.data.Cronograma].sort((a, b) => {
            const pa = { Pendente: 0, 'Em Andamento': 1, Concluido: 2, Cancelado: 3 };
            return pa[a.status] - pa[b.status];
        });
        
        if (registros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary);">Nenhuma manutencao preventiva agendada</td></tr>`;
            return;
        }
        
        tbody.innerHTML = registros.map(r => {
            const v = this.data.Veiculos.find(x => x.id === r.veiculoId);
            const statusClass = r.status === 'Concluido' ? 'status-ativo' : r.status === 'Pendente' ? 'status-manutencao' : 'status-inativo';
            return `
                <tr>
                    <td>${formatDateBR(r.data)}</td>
                    <td><strong>${v?.placa || 'N/A'}</strong></td>
                    <td>${r.servico}</td>
                    <td>${formatKm(r.kmEstimada)}</td>
                    <td>${formatCurrency(r.custoEstimado)}</td>
                    <td><span class="veiculo-status ${statusClass}">${r.status}</span></td>
                    <td>
                        <button class="btn-icon" onclick="App.editCronograma('${r.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="App.deleteCronograma('${r.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async saveCronograma(formData) {
        const isEdit = !!formData.id;
        const record = {
            id: formData.id || generateId(),
            data: formData.data,
            veiculoId: formData.veiculoId,
            servico: formData.servico,
            kmEstimada: formData.kmEstimada,
            custoEstimado: formData.custoEstimado,
            status: formData.status,
            prioridade: formData.prioridade
        };
        
        this.showLoading(isEdit ? 'Atualizando...' : 'Salvando...');
        
        try {
            if (isEdit) {
                await API.update('Cronograma', record.id, record);
                const idx = this.data.Cronograma.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Cronograma[idx] = record;
            } else {
                await API.insert('Cronograma', record);
                this.data.Cronograma.push(record);
            }
            
            API.setCache('Cronograma', this.data.Cronograma);
            this.hideLoading();
            this.closeAllModals();
            this.renderCronograma();
            this.showToast(isEdit ? 'Atualizado!' : 'Registrado!');
        } catch (err) {
            this.hideLoading();
            if (isEdit) {
                const idx = this.data.Cronograma.findIndex(x => x.id === record.id);
                if (idx >= 0) this.data.Cronograma[idx] = record;
            } else {
                this.data.Cronograma.push(record);
            }
            API.setCache('Cronograma', this.data.Cronograma);
            this.closeAllModals();
            this.renderCronograma();
            this.showToast('Salvo localmente.', 'warning');
        }
    },
    
    editCronograma(id) {
        const r = this.data.Cronograma.find(x => x.id === id);
        if (!r) return;
        const modal = document.getElementById('modal-cronograma');
        modal.dataset.editId = id;
        ['data', 'veiculoId', 'servico', 'kmEstimada', 'custoEstimado', 'status', 'prioridade'].forEach(f => {
            const el = modal.querySelector(`[name="${f}"]`);
            if (el) el.value = r[f] || '';
        });
        this.openModal('modal-cronograma');
    },
    
    async deleteCronograma(id) {
        if (!confirm('Excluir este registro?')) return;
        this.showLoading('Excluindo...');
        try {
            await API.remove('Cronograma', id);
            this.data.Cronograma = this.data.Cronograma.filter(x => x.id !== id);
            API.setCache('Cronograma', this.data.Cronograma);
            this.hideLoading();
            this.renderCronograma();
            this.showToast('Excluido!');
        } catch (err) {
            this.hideLoading();
            this.data.Cronograma = this.data.Cronograma.filter(x => x.id !== id);
            API.setCache('Cronograma', this.data.Cronograma);
            this.renderCronograma();
            this.showToast('Excluido localmente.', 'warning');
        }
    },
    
    // ============================================
    // RELATORIOS
    // ============================================
    renderRelatorios() {
        // Grafico de custos por veiculo
        const custoPorVeiculo = {};
        this.data.Abastecimento.forEach(a => {
            const v = this.data.Veiculos.find(x => x.id === a.veiculoId);
            const key = v ? v.placa : 'Desconhecido';
            custoPorVeiculo[key] = (custoPorVeiculo[key] || 0) + (parseFloat(a.valorTotal) || 0);
        });
        
        const ctxCustoVeiculo = document.getElementById('chartCustoPorVeiculo');
        if (window.chartCustoVeiculo) window.chartCustoVeiculo.destroy();
        window.chartCustoVeiculo = new Chart(ctxCustoVeiculo, {
            type: 'bar',
            data: {
                labels: Object.keys(custoPorVeiculo),
                datasets: [{
                    label: 'Total Abastecido',
                    data: Object.values(custoPorVeiculo),
                    backgroundColor: 'rgba(41, 98, 255, 0.7)',
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
        
        // Consumo por veiculo
        const consumoPorVeiculo = {};
        this.data.Abastecimento.forEach(a => {
            const v = this.data.Veiculos.find(x => x.id === a.veiculoId);
            const key = v ? v.placa : 'Desconhecido';
            if (!consumoPorVeiculo[key]) consumoPorVeiculo[key] = { litros: 0, valor: 0 };
            consumoPorVeiculo[key].litros += parseFloat(a.litros) || 0;
            consumoPorVeiculo[key].valor += parseFloat(a.valorTotal) || 0;
        });
        
        const ctxConsumo = document.getElementById('chartConsumoPorVeiculo');
        if (window.chartConsumo) window.chartConsumo.destroy();
        window.chartConsumo = new Chart(ctxConsumo, {
            type: 'line',
            data: {
                labels: Object.keys(consumoPorVeiculo),
                datasets: [{
                    label: 'R$/Litro',
                    data: Object.values(consumoPorVeiculo).map(c => c.litros > 0 ? c.valor / c.litros : 0),
                    borderColor: '#00c853',
                    backgroundColor: 'rgba(0, 200, 83, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
        
        // Tabela de relatorio
        this.renderRelatorioTable();
    },
    
    renderRelatorioTable() {
        const tbody = document.getElementById('relatorioTableBody');
        const filtroVeiculo = document.getElementById('filtroRelatorioVeiculo').value;
        const dataInicio = document.getElementById('filtroDataInicio').value;
        const dataFim = document.getElementById('filtroDataFim').value;
        
        let abast = [...this.data.Abastecimento];
        
        if (filtroVeiculo) abast = abast.filter(a => a.veiculoId === filtroVeiculo);
        if (dataInicio) abast = abast.filter(a => a.data >= dataInicio);
        if (dataFim) abast = abast.filter(a => a.data <= dataFim);
        
        abast.sort((a, b) => new Date(b.data + 'T00:00:00') - new Date(a.data + 'T00:00:00'));
        
        if (abast.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-secondary);">Nenhum registro para o periodo selecionado</td></tr>`;
            return;
        }
        
        tbody.innerHTML = abast.map(a => {
            const v = this.data.Veiculos.find(x => x.id === a.veiculoId);
            return `
                <tr>
                    <td>${formatDateBR(a.data)}</td>
                    <td>${v?.placa || 'N/A'} - ${v?.modelo || ''}</td>
                    <td>${formatNumber(a.litros)} L</td>
                    <td>${formatCurrency(a.valorTotal)}</td>
                    <td>${formatCurrency(a.valorLitro)}</td>
                    <td>${formatKm(a.kmAtual)}</td>
                </tr>
            `;
        }).join('');
        
        const totalLitros = abast.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0);
        const totalValor = abast.reduce((s, a) => s + (parseFloat(a.valorTotal) || 0), 0);
        
        document.getElementById('relatorioTotalLitros').textContent = formatNumber(totalLitros) + ' L';
        document.getElementById('relatorioTotalValor').textContent = formatCurrency(totalValor);
    },
    
    populateRelatorioFiltros() {
        const select = document.getElementById('filtroRelatorioVeiculo');
        select.innerHTML = '<option value="">Todos os veiculos</option>' +
            this.data.Veiculos.map(v => `<option value="${v.id}">${v.placa} - ${v.modelo}</option>`).join('');
    },
    
    exportRelatorio() {
        const filtroVeiculo = document.getElementById('filtroRelatorioVeiculo').value;
        const dataInicio = document.getElementById('filtroDataInicio').value;
        const dataFim = document.getElementById('filtroDataFim').value;
        
        let abast = [...this.data.Abastecimento];
        if (filtroVeiculo) abast = abast.filter(a => a.veiculoId === filtroVeiculo);
        if (dataInicio) abast = abast.filter(a => a.data >= dataInicio);
        if (dataFim) abast = abast.filter(a => a.data <= dataFim);
        abast.sort((a, b) => new Date(b.data + 'T00:00:00') - new Date(a.data + 'T00:00:00'));
        
        let csv = 'Data,Veiculo,Litros,Valor Total,Valor/Litro,KM\n';
        abast.forEach(a => {
            const v = this.data.Veiculos.find(x => x.id === a.veiculoId);
            csv += `${formatDateBR(a.data)},${v?.placa || 'N/A'},${a.litros},${a.valorTotal},${a.valorLitro},${a.kmAtual}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_abastecimento_${formatDate(new Date())}.csv`;
        link.click();
        this.showToast('Relatorio exportado!');
    }
};

// ============================================
// FORM HANDLERS
// ============================================
document.getElementById('formVeiculo').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = {};
    new FormData(e.target).forEach((v, k) => formData[k] = v);
    const modal = document.getElementById('modal-veiculo');
    if (modal.dataset.editId) formData.id = modal.dataset.editId;
    App.saveVeiculo(formData);
});

document.getElementById('formQuilometragem').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = {};
    new FormData(e.target).forEach((v, k) => formData[k] = v);
    const modal = document.getElementById('modal-quilometragem');
    if (modal.dataset.editId) formData.id = modal.dataset.editId;
    App.saveQuilometragem(formData);
});

document.getElementById('formAbastecimento').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = {};
    new FormData(e.target).forEach((v, k) => formData[k] = v);
    const modal = document.getElementById('modal-abastecimento');
    if (modal.dataset.editId) formData.id = modal.dataset.editId;
    App.saveAbastecimento(formData);
});

document.getElementById('formManutencao').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = {};
    new FormData(e.target).forEach((v, k) => formData[k] = v);
    const modal = document.getElementById('modal-manutencao');
    if (modal.dataset.editId) formData.id = modal.dataset.editId;
    App.saveManutencao(formData);
});

document.getElementById('formCronograma').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = {};
    new FormData(e.target).forEach((v, k) => formData[k] = v);
    const modal = document.getElementById('modal-cronograma');
    if (modal.dataset.editId) formData.id = modal.dataset.editId;
    App.saveCronograma(formData);
});

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se a URL da API foi configurada
    if (!CONFIG.API_URL || CONFIG.API_URL === 'SUA_URL_AQUI') {
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;padding:20px;text-align:center;">
                <div style="font-size:48px;color:#2962ff;margin-bottom:20px;"><i class="fas fa-cog"></i></div>
                <h1 style="margin-bottom:10px;">Configuracao Pendente</h1>
                <p style="color:#666;max-width:500px;line-height:1.6;">
                    Voce precisa configurar a URL da API do Google Apps Script.<br>
                    Abra o arquivo <strong>js/config.js</strong> e cole a URL de execucao do seu script.
                </p>
                <div style="margin-top:30px;padding:20px;background:#f5f5f5;border-radius:8px;text-align:left;max-width:500px;font-family:monospace;font-size:12px;">
                    <strong>Passos:</strong><br>
                    1. Crie uma planilha no Google Sheets<br>
                    2. Va em Extensoes > Apps Script<br>
                    3. Cole o codigo do arquivo GoogleAppsScript.gs<br>
                    4. Clique em Implantar > Novo implantacao<br>
                    5. Tipo: Aplicativo da Web<br>
                    6. Acesso: Qualquer pessoa<br>
                    7. Copie a URL e cole em js/config.js
                </div>
            </div>
        `;
        return;
    }
    
    App.init();
});

// 1. CREDENCIAIS DO SUPABASE
const SUPABASE_URL = 'https://fdtyynugsefointunbyg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_heS85H31KelxAFO021Kxpg_yDPGSBCJ';

const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosGlobaisMacro = [];
let dadosGlobaisMicro = [];
let chartEvolucao = null;
let chartDispositivos = null;

google.charts.load('current', { 'packages':['geochart'] });

async function carregarDashboard() {
    try {
        const [resMacro, resMicro] = await Promise.all([
            clienteSupabase.from('dados_ga4_macro').select('*'),
            clienteSupabase.from('dados_ga4').select('*')
        ]);

        if (resMacro.error) throw resMacro.error;
        if (resMicro.error) throw resMicro.error;

        if (resMacro.data && resMicro.data) {
            dadosGlobaisMacro = resMacro.data;
            dadosGlobaisMicro = resMicro.data;
            configurarFiltroDatas();
            aplicarFiltros(); 
            animarComGSAP();
        }
    } catch (err) {
        console.error('Erro na conexão:', err);
    }
}

function formatarData(dataObj) {
    const ano = dataObj.getFullYear();
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dataObj.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function configurarFiltroDatas() {
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 6);

    document.getElementById('data-fim').value = formatarData(hoje);
    document.getElementById('data-inicio').value = formatarData(seteDiasAtras);
    document.getElementById('btn-aplicar').addEventListener('click', aplicarFiltros);
}

function aplicarFiltros() {
    const dataInicioStr = document.getElementById('data-inicio').value;
    const dataFimStr = document.getElementById('data-fim').value;

    if (!dataInicioStr || !dataFimStr) return;

    const inicioMatematica = new Date(dataInicioStr + 'T12:00:00');
    const fimMatematica = new Date(dataFimStr + 'T12:00:00');
    const diasSelecionados = Math.round((fimMatematica - inicioMatematica) / (1000 * 60 * 60 * 24)) + 1;

    const fimAnterior = new Date(inicioMatematica);
    fimAnterior.setDate(inicioMatematica.getDate() - 1);
    
    const inicioAnterior = new Date(fimAnterior);
    inicioAnterior.setDate(fimAnterior.getDate() - diasSelecionados + 1);

    const dataInicioAntStr = formatarData(inicioAnterior);
    const dataFimAntStr = formatarData(fimAnterior);

    const macroAtual = dadosGlobaisMacro.filter(d => d.data >= dataInicioStr && d.data <= dataFimStr);
    const macroAnterior = dadosGlobaisMacro.filter(d => d.data >= dataInicioAntStr && d.data <= dataFimAntStr);
    const microAtual = dadosGlobaisMicro.filter(d => d.data >= dataInicioStr && d.data <= dataFimStr);

    atualizarPainel(macroAtual, macroAnterior, microAtual);
}

function atualizarPainel(macroAtual, macroAnterior, microAtual) {
    processarMetricas(macroAtual, macroAnterior); 
    desenharGraficoEvolucao(macroAtual);          
    desenharGraficoDispositivos(microAtual);      
    processarMapaETabela(microAtual);             
}

function processarMetricas(dadosAtual, dadosAnterior) {
    const somar = (dados, campo) => dados.reduce((acc, linha) => acc + (linha[campo] || 0), 0);

    const calcDelta = (atual, ant) => {
        if (ant === 0 && atual === 0) return { texto: "0%", classe: "neutro" };
        if (ant === 0) return { texto: "Sem dados ant.", classe: "neutro" };
        const percentual = ((atual - ant) / ant) * 100;
        const sinal = percentual > 0 ? "↑" : percentual < 0 ? "↓" : "";
        const classe = percentual > 0 ? "positivo" : percentual < 0 ? "negativo" : "neutro";
        return { texto: `${sinal} ${Math.abs(percentual).toFixed(1)}%`, classe: classe };
    };

    const metricas = ['usuarios_ativos', 'visualizacoes', 'eventos', 'novos_usuarios'];
    const idsTextos = ['val-usuarios', 'val-visualizacoes', 'val-eventos', 'val-novos'];
    const idsDeltas = ['delta-usuarios', 'delta-visualizacoes', 'delta-eventos', 'delta-novos'];

    metricas.forEach((metrica, index) => {
        const valAtual = somar(dadosAtual, metrica);
        const valAnt = somar(dadosAnterior, metrica);
        const delta = calcDelta(valAtual, valAnt);

        document.getElementById(idsTextos[index]).innerText = valAtual;
        const elDelta = document.getElementById(idsDeltas[index]);
        elDelta.innerText = delta.texto;
        elDelta.className = `delta ${delta.classe}`;
    });
}

function desenharGraficoEvolucao(dados) {
    const dadosAgrupados = {};
    dados.forEach(linha => {
        if (!dadosAgrupados[linha.data]) dadosAgrupados[linha.data] = 0;
        dadosAgrupados[linha.data] += linha.usuarios_ativos;
    });

    const datasOrdenadas = Object.keys(dadosAgrupados).sort();
    const valores = datasOrdenadas.map(data => dadosAgrupados[data]);

    const ctx = document.getElementById('graficoEvolucao').getContext('2d');
    if (chartEvolucao) chartEvolucao.destroy(); 
    
    chartEvolucao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datasOrdenadas,
            datasets: [{ label: 'Usuários Ativos', data: valores, borderColor: '#1a73e8', backgroundColor: 'rgba(26, 115, 232, 0.1)', fill: true, tension: 0, pointRadius: 4, pointBackgroundColor: '#1a73e8' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function desenharGraficoDispositivos(dados) {
    const contagem = { desktop: 0, mobile: 0, tablet: 0 };
    dados.forEach(linha => {
        const disp = linha.dispositivo.toLowerCase();
        if (contagem[disp] !== undefined) contagem[disp] += linha.usuarios_ativos;
    });

    const ctx = document.getElementById('graficoDispositivos').getContext('2d');
    if (chartDispositivos) chartDispositivos.destroy();

    chartDispositivos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Desktop', 'Mobile', 'Tablet'],
            datasets: [{ 
                data: [contagem.desktop, contagem.mobile, contagem.tablet], 
                backgroundColor: ['#1a73e8', '#34a853', '#fbbc04'], 
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '65%', 
            plugins: { legend: { position: 'bottom' } } 
        }
    });
}

function processarMapaETabela(dados) {
    const paises = {};
    dados.forEach(linha => {
        if (!paises[linha.pais]) paises[linha.pais] = 0;
        paises[linha.pais] += linha.usuarios_ativos;
    });

    const arrayPaises = Object.keys(paises).map(nome => ({ nome: nome, usuarios: paises[nome] }));
    arrayPaises.sort((a, b) => b.usuarios - a.usuarios);

    const tbody = document.getElementById('corpo-tabela-paises');
    tbody.innerHTML = '';
    arrayPaises.slice(0, 8).forEach(pais => {
        tbody.innerHTML += `<tr><td style="text-align: left;">${pais.nome}</td><td style="text-align: right;">${pais.usuarios}</td></tr>`;
    });

    google.charts.setOnLoadCallback(() => {
        var dadosMapa = new google.visualization.DataTable();
        dadosMapa.addColumn('string', 'País');
        dadosMapa.addColumn('number', 'Usuários');
        arrayPaises.forEach(p => dadosMapa.addRow([p.nome, p.usuarios]));

        var options = {
            colorAxis: {colors: ['#e8f0fe', '#1a73e8']}, 
            backgroundColor: '#ffffff',
            datalessRegionColor: '#f8f9fa', 
            defaultColor: '#f1f3f4',
            legend: 'none'
        };

        var chart = new google.visualization.GeoChart(document.getElementById('mapa-google'));
        chart.draw(dadosMapa, options);
    });
}

function animarComGSAP() {
    gsap.from(".card", { y: 20, opacity: 0, duration: 0.5, stagger: 0.05, ease: "power2.out" });
}

document.getElementById('btn-exportar').addEventListener('click', () => {
    const dataInicioStr = document.getElementById('data-inicio').value;
    const dataFimStr = document.getElementById('data-fim').value;

    const dadosFiltrados = dadosGlobaisMicro.filter(d => d.data >= dataInicioStr && d.data <= dataFimStr);

    if (dadosFiltrados.length === 0) {
        alert("Não há dados para exportar neste período.");
        return;
    }

    let csvContent = "\uFEFFData;País;Cidade;Origem;Dispositivo;Página;Usuários Ativos;Visualizações;Eventos;Novos Usuários\n";

    dadosFiltrados.forEach(linha => {
        let row = [
            linha.data, `"${linha.pais}"`, `"${linha.cidade}"`, `"${linha.origem}"`,
            `"${linha.dispositivo}"`, `"${linha.pagina}"`, linha.usuarios_ativos,
            linha.visualizacoes, linha.eventos, linha.novos_usuarios
        ].join(";");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `relatorio_aspen_${dataInicioStr}_a_${dataFimStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

carregarDashboard();
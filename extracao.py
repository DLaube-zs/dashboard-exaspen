import os
from datetime import datetime, timedelta
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest
from supabase import create_client, Client

# CREDENCIAIS
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "credenciais.json"
ID_DA_PROPRIEDADE = "522886753"
URL_SUPABASE = "https://fdtyynugsefointunbyg.supabase.co"
CHAVE_SUPABASE = "sb_publishable_heS85H31KelxAFO021Kxpg_yDPGSBCJ"

supabase: Client = create_client(URL_SUPABASE, CHAVE_SUPABASE)

def executar_pipeline():
    print("Iniciando extração do Google Analytics...")
    client = BetaAnalyticsDataClient()
    data_limite = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

    # --- 1. CHAMADA MACRO (Totais Perfeitos para os Cards) ---
    print("Buscando dados Macro...")
    req_macro = RunReportRequest(
        property=f"properties/{ID_DA_PROPRIEDADE}",
        dimensions=[Dimension(name="date")],
        metrics=[
            Metric(name="activeUsers"), Metric(name="screenPageViews"), 
            Metric(name="eventCount"), Metric(name="newUsers")
        ],
        date_ranges=[DateRange(start_date="90daysAgo", end_date="today")],
    )
    res_macro = client.run_report(req_macro)
    
    supabase.table("dados_ga4_macro").delete().gte("data", data_limite).execute()

    for row in res_macro.rows:
        data_bruta = row.dimension_values[0].value
        linha_macro = {
            "data": f"{data_bruta[:4]}-{data_bruta[4:6]}-{data_bruta[6:]}",
            "usuarios_ativos": int(row.metric_values[0].value),
            "visualizacoes": int(row.metric_values[1].value),
            "eventos": int(row.metric_values[2].value),
            "novos_usuarios": int(row.metric_values[3].value)
        }
        supabase.table("dados_ga4_macro").insert(linha_macro).execute()

    # --- 2. CHAMADA MICRO (Detalhes para os Gráficos) ---
    print("Buscando dados Micro (Detalhado)...")
    req_micro = RunReportRequest(
        property=f"properties/{ID_DA_PROPRIEDADE}",
        dimensions=[
            Dimension(name="date"), Dimension(name="country"), Dimension(name="city"), 
            Dimension(name="sessionSourceMedium"), Dimension(name="deviceCategory"), Dimension(name="pageTitle")
        ],
        metrics=[
            Metric(name="activeUsers"), Metric(name="screenPageViews"), 
            Metric(name="eventCount"), Metric(name="newUsers")
        ],
        date_ranges=[DateRange(start_date="90daysAgo", end_date="today")],
    )
    res_micro = client.run_report(req_micro)
    
    supabase.table("dados_ga4").delete().gte("data", data_limite).execute()

    for row in res_micro.rows:
        data_bruta = row.dimension_values[0].value
        linha_micro = {
            "data": f"{data_bruta[:4]}-{data_bruta[4:6]}-{data_bruta[6:]}",
            "pais": row.dimension_values[1].value,
            "cidade": row.dimension_values[2].value,
            "origem": row.dimension_values[3].value,
            "dispositivo": row.dimension_values[4].value,
            "pagina": row.dimension_values[5].value,
            "usuarios_ativos": int(row.metric_values[0].value),
            "visualizacoes": int(row.metric_values[1].value),
            "eventos": int(row.metric_values[2].value),
            "novos_usuarios": int(row.metric_values[3].value)
        }
        supabase.table("dados_ga4").insert(linha_micro).execute()
    
    print("Sucesso! Bancos de dados atualizados.")

executar_pipeline()

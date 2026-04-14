# Data360 Technical Integration Plan

## Overview
Integrate World Bank Data360 API (https://data360api.worldbank.org/data360/data) to add V-Dem Democracy Indices, Polity V, IFC GEM Risk, WB ESG, WB SSGD, WB FINDEX, and ITU Digital Health datasets.

## Architecture

### Data Flow
1. Seed scripts pre-compute data → Redis (7-day TTL for annual data)
2. Client bootstraps via `/api/bootstrap?keys=...` on load
3. Client uses RPC with circuit breaker for live queries
4. Static fallback data hardcoded for offline resilience

### Proto Definitions (data360_data.proto)

```protobuf
syntax = "proto3";
package worldmonitor.economic.v1;

message Data360DataPoint {
  string indicator = 1;
  string ref_area = 2;        // ISO-2 or ISO-3 country code
  string country_name = 3;
  int32 time_period = 4;     // Year
  double obs_value = 5;
  string sex = 6;             // Disaggregation: _T = total
  string age = 7;
  string urbanisation = 8;
  string freq = 9;            // A = annual
  string unit_measure = 10;
  string data_source = 11;
  string database_id = 12;
}

message GetData360DataRequest {
  string database_id = 1;     // e.g. "VDEM_CORE", "IFC_GEM"
  string indicator = 2;       // e.g. "VDEM_CORE_V2X_API"
  string ref_area = 3;        // ISO-2 or ISO-3 country code
  int32 time_period_from = 4;
  int32 time_period_to = 5;
  string freq = 6;             // Default: "A" (annual)
  bool is_latest_data = 7;
  int32 top = 8;               // Max records (default 1000)
  int32 skip = 9;              // Pagination offset
}

message GetData360DataResponse {
  repeated Data360DataPoint data = 1;
  int32 total_count = 2;
}

message SearchData360Request {
  string query = 1;
  int32 top = 2;
  string filter = 3;           // OData filter e.g. "type eq 'indicator'"
  string select = 4;
}

message SearchData360Result {
  string id = 1;
  string name = 2;
  string database_id = 3;
  string description = 4;
}

message SearchData360Response {
  repeated SearchData360Result results = 1;
  int32 total_count = 2;
}
```

### RPCs Added to service.proto

```protobuf
rpc GetData360Data(GetData360DataRequest) returns (GetData360DataResponse) {
  option (sebuf.http.config) = {path: "/get-data360-data", method: HTTP_METHOD_GET};
}

rpc SearchData360(SearchData360Request) returns (SearchData360Response) {
  option (sebuf.http.config) = {path: "/search-data360", method: HTTP_METHOD_POST};
}
```

### Server-Side (server/worldmonitor/economic/v1/)

- `get-data360-data.ts` — Queries Data360 API with Redis caching (24h TTL, 7d for governance/democracy data)
- `search-data360.ts` — Proxies searchv2 endpoint
- Indicator mapping function: dots → underscores with DB prefix (`NY.GDP.MKTP.CD` → `WB_WDI_NY_GDP_MKTP_CD`)

### Client-Side (src/services/data360/index.ts)

- Circuit breaker pattern matching existing `economic/index.ts`
- Convenience functions:
  - `fetchVDemScores(countries?)` — V-Dem democracy indices
  - `fetchPolityScores(countries?)` — Polity V regime data
  - `fetchGemRiskScores(countries?)` — IFC GEM risk scores
  - `fetchData360Latest(databaseId, indicator, countries?)` — Generic latest-value fetch
- Bootstrap hydration keys: `vdemBaselines`, `polityBaselines`, `gemRiskBaselines`

### Seed Scripts

- `scripts/seed-data360-vdem.mjs` — V-Dem + Polity → Redis
- `scripts/seed-data360-gem.mjs` — GEM risk → Redis

## Indicator Mappings

### V-Dem (VDEM_CORE) — Key Indicators for DemocracyPanel

| Display Name | Data360 ID |
|---|---|
| Electoral Democracy | VDEM_CORE_V2X_API |
| Liberal Democracy | VDEM_CORE_V2X_LIB |
| Participatory Democracy | VDEM_CORE_V2X_PART |
| Deliberative Democracy | VDEM_CORE_V2X_DL |
| Egalitarian Democracy | VDEM_CORE_V2X_EG |
| Freedom of Expression | VDEM_CORE_V2XME_FREEXP |
| Clean Elections | VDEM_CORE_V2XELECGOV |
| Regime Type | VDEM_CORE_V2X_REGIME |

### Polity V (POLITY5_PRC) — Key Indicators

| Display Name | Data360 ID |
|---|---|
| Polity Score | POLITY5_PRC_POLITY2 |
| Democracy Indicator | POLITY5_PRC_DEMOC |
| Autocracy Indicator | POLITY5_PRC_AUTOC |
| Constraint on Executive | POLITY5_PRC_XCONST |
| Political Competition | POLITY5_PRC_POLCOMP |

### IFC GEM (IFC_GEM) — All 12 Risk Indicators

| Display Name | Data360 ID |
|---|---|
| Political Risk | IFC_GEM_PBD |
| Economic Risk | IFC_GEM_BED |
| Operational Risk | IFC_GEM_OD |
| Sovereign Risk | IFC_GEM_SRD |
| Composite Risk | IFC_GEM_ER |

(Note: All 12 IFC GEM indicators follow same pattern, the above are the 5 main ones)

## Migration Strategy

- Backwards compatible: existing `ListWorldBankIndicators` RPC unchanged
- New `GetData360Data` RPC added alongside
- Client falls back to legacy WB v2 for non-Data360 indicators
- Feature flag: `economicData360` for gradual rollout
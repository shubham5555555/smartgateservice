Grafana dashboards and alerting (suggested)
------------------------------------------

1) Import dashboards:
- Create panels for:
  - API latency (histogram from prom_client metrics)
  - Error rate (count of non-2xx responses)
  - Request rate (requests per endpoint)
  - Redis/BullMQ queue length (exposed via job queue metrics)
  - Cache hit rate (custom metric)

2) Example alert rules:
- High error rate: when error rate > 1% over 5m for main endpoints -> notify on-call.
- High queue backlog: when BullMQ queue length > 100 for > 2m -> create PagerDuty/Slack alert.
- High latency: 95th percentile latency > 1s for > 5m -> alert.

3) Data sources:
- Prometheus scrapes /metrics endpoint on the API servers.
- Redis and BullMQ exporter metrics can be added to Prometheus.

4) Notes:
- Use Grafana templating variables for environment (prod/stage).
- Keep dashboards focused on actionable metrics.


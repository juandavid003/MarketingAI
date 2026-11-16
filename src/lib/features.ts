// Product feature flags, read from env so a feature can be turned back on
// per-environment without a code change.
//
// Paid ads (Meta Ads "pautaje") are FROZEN pending a business review — see
// docs/MVP_SCOPE.md. The code (lib/meta.ts ad helpers, ads-actions.ts,
// AdCampaign/MetaAdAccount models) is kept intact but unreachable: the UI is
// hidden, every ads server action refuses to run, and the Meta OAuth dialog
// stops asking for ads_management. Set FEATURE_ADS=true to re-enable.
export const ADS_ENABLED = process.env.FEATURE_ADS === "true";

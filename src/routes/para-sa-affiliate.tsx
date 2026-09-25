import { createFileRoute } from "@tanstack/react-router";
import { MarketingAudiencePage } from "../legacy/components/MarketingAudiencePage";

const title = "Kumita sa Pag-promote ng GoPalengke";
const description = "Lifetime 2-tier commission: ₱150 kada seller milestone, ₱35 kada rider milestone, at ₱50/₱15 override mula sa mga kapwa affiliate na naimbitahan mo. Walang limit.";
const image = "https://www.gopalengke.net/images/gopalengke-affiliate-marketing.jpg";

export const Route = createFileRoute("/para-sa-affiliate")({
  ssr: false,
  head: () => ({ meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: image },
  ]}),
  component: () => <MarketingAudiencePage audience="affiliate" />,
});

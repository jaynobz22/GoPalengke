import { createFileRoute } from "@tanstack/react-router";
import { MarketingAudiencePage } from "../legacy/components/MarketingAudiencePage";

const title = "Kumita Bilang Delivery Rider — GoPalengke";
const description = "Sumali bilang GoPalengke rider, tumanggap ng market deliveries na tugma sa sasakyan mo, at gamitin ang delivery dashboard, mapa, chat, at history.";
const image = "https://www.gopalengke.net/images/gopalengke-rider-marketing.jpg";

export const Route = createFileRoute("/para-sa-rider")({
  ssr: false,
  head: () => ({ meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: image },
  ]}),
  component: () => <MarketingAudiencePage audience="rider" />,
});

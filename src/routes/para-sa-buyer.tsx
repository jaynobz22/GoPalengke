import { createFileRoute } from "@tanstack/react-router";
import { MarketingAudiencePage } from "../legacy/components/MarketingAudiencePage";

const title = "Online Palengke Delivery — GoPalengke";
const description = "Mamili ng sariwang isda, karne, gulay, prutas, at iba pang paninda mula sa verified stores, may chat, order tracking, at delivery sa bahay.";
const image = "https://www.gopalengke.net/images/gopalengke-buyer-marketing.jpg";

export const Route = createFileRoute("/para-sa-buyer")({
  ssr: false,
  head: () => ({ meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: image },
  ]}),
  component: () => <MarketingAudiencePage audience="buyer" />,
});

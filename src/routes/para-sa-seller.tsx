import { createFileRoute } from "@tanstack/react-router";
import { MarketingAudiencePage } from "../legacy/components/MarketingAudiencePage";

const title = "Magbenta Online sa GoPalengke — Para sa Sellers";
const description = "Gumawa ng online store para sa panindang palengke, tumanggap ng orders sa phone, makipag-chat sa buyers, at gamitin ang GoPalengke delivery network.";
const image = "https://www.gopalengke.net/images/gopalengke-seller-marketing.jpg";

export const Route = createFileRoute("/para-sa-seller")({
  ssr: false,
  head: () => ({ meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: image },
  ]}),
  component: () => <MarketingAudiencePage audience="seller" />,
});

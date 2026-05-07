import { MraFlowClient } from "../../components/MraFlowClient";
import { MraPageChrome } from "../../components/MraPageChrome";

type PageProps = {
  params: Promise<{ videoId: string }>;
};

export default async function MraVideoPage({ params }: PageProps) {
  const { videoId } = await params;
  const decoded = decodeURIComponent(videoId);

  return (
    <MraPageChrome>
      <MraFlowClient key={decoded} videoId={decoded} />
    </MraPageChrome>
  );
}

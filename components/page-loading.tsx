export function PageLoading({ label = "데이터를 불러오는 중" }: { label?: string }) {
  return <div className="page-loading"><span className="spinner" /><p>{label}</p></div>;
}

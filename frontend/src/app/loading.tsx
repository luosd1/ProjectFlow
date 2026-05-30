export default function Loading() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 h-10 w-10 animate-spin rounded-full border-2 border-moss/20 border-t-moss" />
      <p className="text-sm font-semibold text-ink">正在加载项目状态...</p>
    </section>
  );
}

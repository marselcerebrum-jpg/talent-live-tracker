/** Kerangka halaman yang tampil seketika saat pindah halaman, sambil menunggu data. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman">
      <div className="page-head"><div><div className="skel" style={{ width: 220, height: 40 }} /><div className="skel" style={{ width: 160, height: 16, marginTop: 10 }} /></div></div>
      <div className="stats" style={{ marginBottom: 20 }}>
        {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 96, borderRadius: 16 }} />)}
      </div>
      <div className="skel-card">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="row" style={{ gap: 14 }}>
            <div className="skel" style={{ width: 38, height: 38, borderRadius: "50%" }} />
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              <div className="skel" style={{ width: "45%", height: 14 }} />
              <div className="skel" style={{ width: "70%", height: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

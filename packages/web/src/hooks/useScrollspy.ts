import { useEffect, useState } from "react";
import { scrollOffset } from "../utils/scrollOffset";
import { activeHeadingId } from "../utils/scrollspy";

export function useScrollspy(ids: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  // 依「內容」而非陣列 identity 訂閱：呼叫端每次 render 都給新陣列，直接相依 ids 會每次
  // 重新掛卸監聽。id 是 slugifyHeading 的輸出（非字母數字皆轉為 -），不可能含有 "|"，
  // 故 join/split 為無損往返，effect 內只需相依這個 key。
  const idsKey = ids.join("|");

  useEffect(() => {
    const idList = idsKey ? idsKey.split("|") : [];
    if (idList.length === 0) {
      setActiveId(null);
      return;
    }

    const computeActive = () => {
      // 與錨點捲動同一條偏移線（sticky header 底邊），highlight 才會對上實際置頂的 heading
      const threshold = scrollOffset();
      const tops = idList.map((id) => {
        const el = document.getElementById(id);
        return { id, top: el ? el.getBoundingClientRect().top : null };
      });
      setActiveId(activeHeadingId(tops, threshold));
    };

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        computeActive();
      });
    };

    computeActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [idsKey]);

  return activeId;
}

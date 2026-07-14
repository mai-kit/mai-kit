<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";

const props = withDefaults(
  defineProps<{
    mode?: "home" | "full";
  }>(),
  { mode: "full" },
);

const previews = [
  {
    key: "poster",
    title: "完整 B50 海报",
    description: "玩家档案、B15 / B35、统计分布与谱面雷达集中在一张画布。",
    method: "draw.poster()",
    src: "/draw/poster.webp",
    alt: "mai-kit draw 完整 B50 成绩海报渲染效果",
    wide: true,
  },
  {
    key: "best50",
    title: "Best50 全曲板",
    description: "按源顺序展示新曲 15 首与旧曲 35 首。",
    method: "draw.best50()",
    src: "/draw/best50.webp",
    alt: "mai-kit draw Best50 全曲板渲染效果",
    wide: true,
  },
  {
    key: "chart",
    title: "单曲成绩卡",
    description: "突出封面、达成率、Rating、DX 分与成绩徽章。",
    method: "draw.chart()",
    src: "/draw/chart.webp",
    alt: "mai-kit draw 单曲成绩卡渲染效果",
    wide: false,
  },
  {
    key: "upgrades",
    title: "加分推荐板",
    description: "把候选曲目的目标成绩与预期 B50 增量排在同一视图。",
    method: "draw.upgrades()",
    src: "/draw/upgrades.webp",
    alt: "mai-kit draw 加分推荐板渲染效果",
    wide: false,
  },
] as const;

const visiblePreviews = computed(() =>
  props.mode === "home" ? previews.filter((preview) => preview.key !== "best50") : previews,
);
</script>

<template>
  <section
    class="draw-gallery"
    :class="`draw-gallery--${mode}`"
    :aria-labelledby="mode === 'home' ? 'draw-gallery-title' : undefined"
    :aria-label="mode === 'full' ? '渲染效果预览' : undefined"
  >
    <header v-if="mode === 'home'" class="draw-gallery__header">
      <div>
        <p class="draw-gallery__eyebrow">@mai-kit/draw</p>
        <h2 id="draw-gallery-title">渲染效果预览</h2>
        <p class="draw-gallery__lead">
          同一套 16:9 视觉语言，可输出 PNG 或 SVG，并在 Node 与浏览器保持一致的公开 API。
        </p>
      </div>
      <a class="draw-gallery__more" :href="withBase('/guide/draw-preview')">
        查看全部版式 <span aria-hidden="true">→</span>
      </a>
    </header>

    <div class="draw-gallery__grid">
      <figure
        v-for="preview in visiblePreviews"
        :key="preview.key"
        class="draw-gallery__item"
        :class="{ 'draw-gallery__item--wide': preview.wide }"
      >
        <a
          class="draw-gallery__image-link"
          :href="withBase(preview.src)"
          :aria-label="`${preview.title}：查看大图`"
        >
          <img
            :src="withBase(preview.src)"
            :alt="preview.alt"
            width="1920"
            height="1080"
            loading="lazy"
          />
        </a>
        <figcaption>
          <span class="draw-gallery__caption-copy">
            <strong>{{ preview.title }}</strong>
            <span>{{ preview.description }}</span>
          </span>
          <code>{{ preview.method }}</code>
        </figcaption>
      </figure>
    </div>

    <p v-if="mode === 'full'" class="draw-gallery__note">
      图片由 LXNS 集成测试的真实数据渲染生成；文档资源压缩为 1920×1080
      WebP，点击图片可单独查看大图。
    </p>
  </section>
</template>

<style scoped>
.draw-gallery {
  margin: clamp(3.5rem, 9vw, 7rem) auto 1rem;
}

.draw-gallery--full {
  margin-top: 2rem;
}

.draw-gallery__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
}

.draw-gallery__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--vp-c-brand-1);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.draw-gallery h2 {
  margin: 0;
  border: 0;
  font-size: clamp(1.8rem, 4vw, 2.65rem);
  line-height: 1.08;
}

.draw-gallery__lead {
  max-width: 42rem;
  margin: 0.85rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 1rem;
  line-height: 1.75;
}

.draw-gallery__more {
  flex: none;
  padding-block: 0.35rem;
  color: var(--vp-c-brand-1);
  font-size: 0.9rem;
  font-weight: 650;
  text-decoration: none;
}

.draw-gallery__more span {
  display: inline-block;
  margin-left: 0.25rem;
  transition: transform 180ms ease-out;
}

.draw-gallery__more:hover span {
  transform: translateX(0.25rem);
}

.draw-gallery__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.5rem, 4vw, 2.75rem) clamp(1rem, 3vw, 1.75rem);
}

.draw-gallery__item {
  min-width: 0;
  margin: 0;
}

.draw-gallery__item--wide {
  grid-column: 1 / -1;
}

.draw-gallery__image-link {
  display: block;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 22%, var(--vp-c-divider));
  border-radius: 12px;
  background: #f5f1ff;
  box-shadow: 0 18px 50px color-mix(in srgb, var(--vp-c-brand-1) 9%, transparent);
}

.draw-gallery__image-link:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 4px;
}

.draw-gallery__image-link img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.draw-gallery__image-link:hover img {
  transform: scale(1.012);
}

.draw-gallery figcaption {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 0.15rem 0;
}

.draw-gallery__caption-copy {
  display: grid;
  gap: 0.2rem;
}

.draw-gallery__caption-copy strong {
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
}

.draw-gallery__caption-copy > span {
  color: var(--vp-c-text-2);
  font-size: 0.84rem;
  line-height: 1.55;
}

.draw-gallery figcaption code {
  flex: none;
  margin-top: 0.05rem;
  color: var(--vp-c-brand-1);
  font-size: 0.75rem;
  white-space: nowrap;
}

.draw-gallery__note {
  margin: 2rem 0 0;
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
  line-height: 1.65;
}

@media (max-width: 700px) {
  .draw-gallery__header {
    display: grid;
    gap: 0.75rem;
  }

  .draw-gallery__grid {
    grid-template-columns: 1fr;
  }

  .draw-gallery__item--wide {
    grid-column: auto;
  }

  .draw-gallery figcaption {
    display: grid;
    gap: 0.55rem;
  }

  .draw-gallery figcaption code {
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .draw-gallery__more span,
  .draw-gallery__image-link img {
    transition: none;
  }
}
</style>

import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Formatter } from "vexflow";
import { midiToNote } from "./audio";

// 把 "F4" 转成 VexFlow 需要的 "f/4" 格式
function toVexKey(note: string): string {
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) return "c/4";
  return `${m[1].toLowerCase()}/${m[2]}`;
}

// 在高音谱表上画一个音
export default function Staff({ midi }: { midi: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    div.innerHTML = ""; // 清空上一次的画

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(260, 150);
    const context = renderer.getContext();

    const stave = new Stave(10, 25, 240);
    stave.addClef("treble");
    stave.setContext(context).draw();

    const note = new StaveNote({
      clef: "treble",
      keys: [toVexKey(midiToNote(midi))],
      duration: "w", // 全音符
    });
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
    voice.addTickables([note]);
    new Formatter().joinVoices([voice]).format([voice], 170);
    voice.draw(context, stave);

    return () => {
      div.innerHTML = "";
    };
  }, [midi]);

  return <div ref={ref} className="staffCard" />;
}
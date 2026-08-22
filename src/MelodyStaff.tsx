import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from "vexflow";
import type { Clef } from "./lessons";

function toVexKey(midi: number): string {
  const names = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const octave = Math.floor(midi / 12) - 1;
  return names[midi % 12] + "/" + octave;
}

// 一条带空缺的旋律：空缺处画成休止符
export default function MelodyStaff({
  notes,
  gapIndex,
  clef = "treble",
}: {
  notes: number[];
  gapIndex: number;
  clef?: Clef;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    div.innerHTML = "";
    const width = 100 + notes.length * 64;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(width, 150);
    const ctx = renderer.getContext();
    const stave = new Stave(10, 25, width - 20);
    stave.addClef(clef);
    stave.setContext(ctx).draw();
    const restKey = clef === "bass" ? "d/3" : "b/4";
    const vexNotes = notes.map((m, i) => {
      if (i === gapIndex) {
        return new StaveNote({ keys: [restKey], duration: "qr", clef: clef });
      }
      const key = toVexKey(m);
      const n = new StaveNote({ keys: [key], duration: "q", clef: clef });
      if (key.includes("#")) n.addModifier(new Accidental("#"), 0);
      return n;
    });
    const voice = new Voice({ numBeats: notes.length, beatValue: 4 }).setStrict(false);
    voice.addTickables(vexNotes);
    new Formatter().joinVoices([voice]).format([voice], width - 130);
    voice.draw(ctx, stave);
    return () => {
      div.innerHTML = "";
    };
  }, [notes, gapIndex, clef]);

  return <div ref={ref} className="staffCard" />;
}
import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Formatter } from "vexflow";
import type { Clef } from "./lessons";

function toVexKey(midi: number): string {
  const names = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const octave = Math.floor(midi / 12) - 1;
  return names[midi % 12] + "/" + octave;
}

export default function Staff({
  midi,
  clef = "treble",
}: {
  midi: number;
  clef?: Clef;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    div.innerHTML = "";
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(260, 150);
    const ctx = renderer.getContext();
    const stave = new Stave(10, 25, 240);
    stave.addClef(clef);
    stave.setContext(ctx).draw();
    const note = new StaveNote({
      keys: [toVexKey(midi)],
      duration: "w",
      clef: clef,
    });
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
    voice.addTickables([note]);
    new Formatter().joinVoices([voice]).format([voice], 170);
    voice.draw(ctx, stave);
    return () => {
      div.innerHTML = "";
    };
  }, [midi, clef]);

  return <div ref={ref} className="staffCard" />;
}
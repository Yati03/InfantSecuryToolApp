import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

interface AuroraProps {
  colorStops: string[];
  blend: number;
  amplitude: number;
  speed: number;
}

const VERT = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uBlend;
  uniform float uAmplitude;

  void main() {
    float t = uTime;

    float wave1 = sin(vUv.x * 2.5 + t * 0.9) * uAmplitude * 0.13 + 0.28;
    float wave2 = sin(vUv.x * 1.7 - t * 0.65 + 1.1) * uAmplitude * 0.16 + 0.52;
    float wave3 = sin(vUv.x * 3.1 + t * 1.1 + 2.3) * uAmplitude * 0.11 + 0.74;

    float d1 = exp(-pow((vUv.y - wave1) / 0.14, 2.0));
    float d2 = exp(-pow((vUv.y - wave2) / 0.14, 2.0));
    float d3 = exp(-pow((vUv.y - wave3) / 0.14, 2.0));

    vec3 col = uColor1 * d1 + uColor2 * d2 + uColor3 * d3;
    col *= uBlend * 1.6;
    col = clamp(col, 0.0, 1.0);

    vec3 bg = vec3(0.02, 0.04, 0.06);
    float totalDensity = clamp(d1 + d2 + d3, 0.0, 1.0);
    col = mix(bg, col, totalDensity * uBlend + 0.1);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function hexToVec3(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

export default function Aurora({ colorStops, blend, amplitude, speed }: AuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const renderer = new Renderer({ canvas, alpha: false });
    const gl = renderer.gl;

    const resize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const geometry = new Triangle(gl);
    const stops = colorStops.slice(0, 3);
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: hexToVec3(stops[0] ?? '#66ffc4') },
        uColor2: { value: hexToVec3(stops[1] ?? '#ffce1f') },
        uColor3: { value: hexToVec3(stops[2] ?? '#ff9029') },
        uBlend: { value: blend },
        uAmplitude: { value: amplitude },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    let animId: number;
    function animate(t: number) {
      animId = requestAnimationFrame(animate);
      program.uniforms.uTime.value = (t / 1000) * speed;
      renderer.render({ scene: mesh });
    }
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      container.removeChild(canvas);
    };
  }, [colorStops, blend, amplitude, speed]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#050a10' }}
    />
  );
}

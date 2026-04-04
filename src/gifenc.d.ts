declare module "gifenc" {
    export type GifPalette = number[] | Uint8Array;
    export type GifEncoder = {
        writeFrame(
            index: Uint8Array | Uint16Array | number[],
            width: number,
            height: number,
            opts?: {
                palette?: GifPalette;
                delay?: number;
                transparent?: boolean;
                transparentIndex?: number;
                repeat?: number;
            }
        ): void;
        finish(): void;
        bytes(): Uint8Array;
    };

    export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoder;
    export function quantize(
        rgba: Uint8Array | Uint8ClampedArray,
        maxColors: number,
        opts?: { format?: string; oneBitAlpha?: boolean; clearAlpha?: boolean }
    ): GifPalette;
    export function applyPalette(
        rgba: Uint8Array | Uint8ClampedArray,
        palette: GifPalette,
        format?: string
    ): Uint8Array;
}

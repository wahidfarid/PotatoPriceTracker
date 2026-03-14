export function detectFinish(title: string, foilFlg?: number): { isFoil: boolean; finish: string } {
    if (/【サージ・Foil】|【Surge・Foil】|サージ・Foil/.test(title)) return { isFoil: true, finish: 'surgefoil' };
    if (/【エッチング・Foil】|エッチング・Foil/.test(title)) return { isFoil: true, finish: 'etchedfoil' };
    if (/\(フラクチャーFOIL\)|Fracture FOIL|\(Fracture\)/.test(title)) return { isFoil: true, finish: 'fracturefoil' };
    if (/\(ダブルレインボウFOIL\)/.test(title)) return { isFoil: true, finish: 'doublerainbowfoil' };
    if (/\(サージFOIL\)/.test(title)) return { isFoil: true, finish: 'surgefoil' };
    if (/【Foil】|\(FOIL\)|Foil/.test(title)) return { isFoil: true, finish: 'foil' };
    if (foilFlg === 1) return { isFoil: true, finish: 'foil' };
    return { isFoil: false, finish: 'nonfoil' };
}

export function getFinishLabel(finish: string): string {
    switch (finish) {
        case 'nonfoil': return 'Norm';
        case 'foil': return 'Foil';
        case 'surgefoil': return 'Surge';
        case 'etchedfoil': return 'Etched';
        case 'fracturefoil': return 'Fracture';
        case 'doublerainbowfoil': return 'DblRnbw';
        default: return finish;
    }
}

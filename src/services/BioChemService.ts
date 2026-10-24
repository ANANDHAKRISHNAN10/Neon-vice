import { fetchWithRetry } from './fetchWithRetry';

export interface PubChemCompoundProfile {
  queryName: string;
  cid: number;
  molecularFormula: string;
  molecularWeight: number;
  canonicalSmiles: string;
  inchiKey: string;
  xLogP: number;
  tpsa: number;
  hBondDonorCount: number;
  hBondAcceptorCount: number;
  rotatableBondCount: number;
  complexity: number;
  image2dUrl: string;
  pubchemRecordUrl: string;
  lipinskiViolations: number;
  lipinskiPass: boolean;
  veberPass: boolean;
  bbbPermeable: boolean;
}

const cache = new Map<string, PubChemCompoundProfile>();

export const PRESET_LAB_COMPOUNDS = [
  'Lidocaine',
  'Epinephrine',
  'Caffeine',
  'Dopamine',
  'Aspirin',
  'Imatinib',
];

export async function fetchPubChemCompound(
  compoundName: string,
): Promise<PubChemCompoundProfile> {
  const normalized = compoundName.trim().toLowerCase();
  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  const encoded = encodeURIComponent(compoundName.trim());
  const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encoded}/cids/JSON`;
  const cidRes = await fetchWithRetry(cidUrl);
  const cidData = await cidRes.json();
  const cid: number | undefined = cidData?.IdentifierList?.CID?.[0];

  if (!cid) {
    throw new Error(`No PubChem CID found for "${compoundName}"`);
  }

  const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,Complexity/JSON`;
  const propRes = await fetchWithRetry(propUrl);
  const propData = await propRes.json();
  const prop = propData?.PropertyTable?.Properties?.[0];

  if (!prop) {
    throw new Error(`No physicochemical properties returned for CID ${cid}`);
  }

  const mw = Number(prop.MolecularWeight ?? 0);
  const xLogP = Number(prop.XLogP ?? 0);
  const tpsa = Number(prop.TPSA ?? 0);
  const hbd = Number(prop.HBondDonorCount ?? 0);
  const hba = Number(prop.HBondAcceptorCount ?? 0);
  const rotBonds = Number(prop.RotatableBondCount ?? 0);

  let violations = 0;
  if (mw > 500) violations++;
  if (xLogP > 5) violations++;
  if (hbd > 5) violations++;
  if (hba > 10) violations++;

  const profile: PubChemCompoundProfile = {
    queryName: compoundName.trim(),
    cid,
    molecularFormula: String(prop.MolecularFormula ?? 'N/A'),
    molecularWeight: mw,
    canonicalSmiles: String(
      prop.CanonicalSMILES ?? prop.ConnectivitySMILES ?? 'N/A',
    ),
    inchiKey: String(prop.InChIKey ?? 'N/A'),
    xLogP,
    tpsa,
    hBondDonorCount: hbd,
    hBondAcceptorCount: hba,
    rotatableBondCount: rotBonds,
    complexity: Number(prop.Complexity ?? 0),
    image2dUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=300x300`,
    pubchemRecordUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    lipinskiViolations: violations,
    lipinskiPass: violations <= 1,
    veberPass: rotBonds <= 10 && tpsa <= 140,
    bbbPermeable: tpsa > 0 && tpsa < 90,
  };

  cache.set(normalized, profile);
  return profile;
}

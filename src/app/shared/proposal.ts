export interface QuoteProposal {
  title: string;
  introduction: string;
  company_profile: string;
  scope: string;
  specifications: string;
  site_requirements: string;
  warranty: string;
  payment_terms: string;
  advance_percent: number;
  signatory: string;
  reference_projects: string;
}

export function newProposal(shutter = false): QuoteProposal {
  return {
    title: shutter ? 'Premium automatic shutter system' : 'Techno-commercial proposal',
    introduction:
      'Thank you for the opportunity to discuss your requirements. We are pleased to present our proposal for the supply and installation described in this document. We look forward to your order and assure you of our quality, service and continued support.',
    company_profile:
      'Established in 1975, Chemmanoor Metals provides rolling shutters, gates and engineering solutions, with over 50 years of industry experience. For more than 20 years, we have specialised in automation and customised systems.\n\nOur CNC-based production lines and roll-forming processes support accurate manufacturing and smooth shutter movement. Premium materials, careful fabrication and installation by our own trained teams help us deliver consistent quality.\n\nWe develop solutions for security, convenience, durability and performance. Our work includes commercial, industrial and residential projects across India, with automation consulting experience in the Middle East and Europe.\n\nWith more than 10,000 projects completed, we continue to focus on practical innovation and long-term service support.',
    scope: '',
    specifications: shutter
      ? 'Aluzinc CNC micro-nano perforated, 0.90 mm profile with powder-coated finish.\n2 mm guide channels, bottom plate and MS shaft. Hood cover by client.\n600 kg side-drive motor (560 W), remote control, manual switch and chain operation.\nAnti-fall lock, thermal cut-off and dual limit switch.\nNylon strips for low-noise movement and rubber seals for insect protection.'
      : '',
    site_requirements:
      'Site must be clear of debris and ready for installation.\nElectrical supply, separate ELCB, proper earthing and connection by the site electrician are the customer’s responsibility.\nCivil works, plastering and painting are excluded.\nUnloading charges are additional.\nFloor level marking is required before installation.',
    warranty: shutter
      ? '3-year warranty, excluding remote and receiver.\nUnauthorised modifications void the warranty. Post-warranty service is chargeable.\nKeep the opening clear during operation and protect the remote and receiver from water.'
      : '',
    payment_terms:
      'Advance payable with the work order. Balance payable on the day of installation.\nDelivery within 20 days from agreement, subject to site readiness.',
    advance_percent: 60,
    signatory: '',
    reference_projects:
      'Cattle Feed Plant, Thodupuzha\nLulu Convention and Exhibition Centre, Bolgatti, Ernakulam\nGreen Land International Indoor Stadium, Kazhakuttam\nCalicut Airport duty free shop\nFFB, Sobha City, Thrissur\nDhanalakshmi corporate office, Thrissur\nSelex Mall, Thrissur\nMax Retail showroom, Coimbatore\nCBRE, Hyderabad',
  };
}

/** Remove only the known starter payment sentence, superseded by the schedule. */
export function proposalTerms(terms: string): string {
  return terms.replace(
    '1. 50% advance with the order; balance before delivery.',
    '1. Advance and balance payments are as specified in the payment schedule.',
  );
}

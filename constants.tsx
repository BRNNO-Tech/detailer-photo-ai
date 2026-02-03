
import { Service } from './types';

export const SERVICES: Service[] = [
  {
    id: 'full_detail',
    name: 'Full Detail',
    description: 'Complete interior and exterior rejuvenation for the ultimate shine.',
    icon: '✨',
    checklist: [
      'Front 3/4 angle',
      'Side profile',
      'Rear 3/4 angle',
      'Wheels close‑up',
      'Dashboard',
      'Seats',
      'Floor mats',
      'Trunk',
      'Final glam shot'
    ]
  },
  {
    id: 'interior_detail',
    name: 'Interior Detail',
    description: 'Deep clean of carpets, seats, and dashboard.',
    icon: '💺',
    checklist: [
      'Dashboard before & after',
      'Seat textures',
      'Floor mat comparison',
      'Center console details',
      'Door panels',
      'Ceiling/Headliner'
    ]
  },
  {
    id: 'exterior_detail',
    name: 'Exterior Detail',
    description: 'Clay bar, wax, and paint decontamination.',
    icon: '🚗',
    checklist: [
      'Front hood reflection',
      'Side door panels',
      'Wheel & tire shine',
      'Grille details',
      'Glass clarity',
      'Paint depth profile'
    ]
  },
  {
    id: 'ceramic_coating',
    name: 'Ceramic Coating',
    description: 'Long-term paint protection and hydrophobic properties.',
    icon: '🛡️',
    checklist: [
      'Full body gloss',
      'Water beading close-up',
      'Applicator bottle shot',
      'Mirror cap reflection',
      'Wheel coating detail'
    ]
  },
  {
    id: 'paint_correction',
    name: 'Paint Correction',
    description: 'Swirl mark and scratch removal.',
    icon: '🪄',
    checklist: [
      'Swirl marks (Halogen light)',
      '50/50 split shot',
      'Hood clarity',
      'Fender scratch removal',
      'Finished gloss levels'
    ]
  },
  {
    id: 'engine_bay',
    name: 'Engine Bay',
    description: 'Degreasing and dressing the engine compartment.',
    icon: '⚙️',
    checklist: [
      'Main engine overview',
      'Hoses & plastics',
      'Valve cover close-up',
      'Firewall area',
      'Underside of hood'
    ]
  }
];

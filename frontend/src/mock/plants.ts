import { addDays, today } from '../domain/format'
import type { PlantLine } from '../domain/types'
import type { PlantsProject } from '../data/plants'

/**
 * Stand-ins for projects in the plants app, used only by the offline demo.
 * The Ashraf residence list is the one on the company's own quotation, so its
 * totals can be checked against that document (plants ₹2,85,800). The others
 * are drawn from the same plants for the seeded projects. The real plants app
 * holds photos; these have none.
 */

let serial = 0
function plant(name: string, botanical: string, category: string, size: string | undefined, quantity: number, unit: string | undefined, rate: number): PlantLine {
  serial += 1
  return { plantId: `demo-plant-${serial}`, name, botanical, category, size, quantity, unit, rate }
}

const ASHRAF: PlantLine[] = [
  plant('Swiss cheese plant', 'Monstera deliciosa', 'Climber', '2.5', 12, 'Nos', 700),
  plant('Fishtail Fern', 'Nephrolepis falcata', 'Fern', '1.5', 30, 'Nos', 250),
  plant('Boston Fern', 'Nephrolepis exaltata', 'Fern', '1', 50, 'Nos', 180),
  plant('Bird’s nest fern', 'Asplenium nidus', 'Fern', '2', 5, 'Nos', 800),
  plant('Ribbon Grass-Green', 'Phalaris arundinacea', 'Grass', '1', 60, 'Nos', 80),
  plant('Pearl Grass', 'Ophiopogon japonicus', 'Groundcover', undefined, 1180, 'Sqft', 45),
  plant('Portodora Elephant Ear', 'Alocasia portodora', 'Other', '2', 3, 'Nos', 950),
  plant('Rain Lily', 'Zephyranthes rosea', 'Other', '0.5', 100, 'Nos', 60),
  plant('Bird of Paradise', 'Strelitzia reginae', 'Other', '2.5', 10, 'Nos', 950),
  plant('Red Homalomena; Queen of Hearts', 'Homalomena rubescens', 'Other', '1', 12, 'Nos', 600),
  plant('Spider lily', 'Hymenocallis littoralis', 'Other', '1', 60, 'Nos', 120),
  plant('Cannifolium peace lily', 'Spathiphyllum cannifolium', 'Other', '1', 40, 'Nos', 400),
  plant('Water heliconia', 'Heliconia psittacorum', 'Other', '3-6', 25, 'Nos', 350),
  plant('Calathea zebrina', 'Goeppertia zebrina', 'Other', '1', 12, 'Nos', 550),
  plant('Philodendron Selloum', 'Philodendron selloum', 'Other', '2', 10, 'Nos', 700),
  plant('Canna lily-PINK', 'Canna indica', 'Other', '3', 15, 'Nos', 450),
  plant('Sexy Pink Heliconia; Pink Flamingo Heliconia', 'Heliconia chartacea', 'Other', '4-6', 20, 'Nos', 450),
  plant('Torch Ginger-PINK', 'Etlingera elatior', 'Other', '4-7', 20, 'Nos', 450),
  plant('Philodendron Burle Marx', 'Philodendron Burle Marx', 'Other', '1', 30, 'Nos', 120),
  plant('Slender lady palm', 'Rhapis humilis', 'Palm', '3-4', 12, 'Nos', 900),
  plant('Macarthur palm', 'Ptychosperma macarthurii', 'Palm', undefined, 15, undefined, 900),
  plant('Finger Arelia', 'Osmoxylon lineare', 'Shrub', '1', 60, 'Nos', 120),
  plant('Umbrella Papyrus; Umbrella Sedge', 'Cyperus alternifolius', 'Shrub', undefined, 60, 'Nos', 150),
  plant('Dwarf cardamom; Shell ginger', 'Alpinia nutans', 'Shrub', '3', 20, 'Nos', 400),
  plant('Red ginger', 'Alpinia purpurata', 'Shrub', undefined, 10, 'Nos', 550),
  plant('Japanese spindle tree', 'Euonymus japonicus', 'Shrub', undefined, 1, undefined, 3000),
  plant('Macaw Flower', 'Heliconia bihai', 'Shrub', undefined, 30, 'Nos', 450),
  plant('Muraya', 'Murraya paniculata', 'Shrub', undefined, 10, 'Nos', 700),
  plant('Philodendron Xanadu', 'Philodendron xanadu', 'Shrub', undefined, 20, 'Nos', 300),
  plant('Night-flowering Jasmine; Parijata; Harsingar', 'Nyctanthes arbor-tristis', 'Tree', undefined, 2, 'Nos', 750),
  plant('Spanish cherry', 'Mimusops elengi', 'Tree', undefined, 1, undefined, 3000),
  plant('Ferntree', 'Filicium decipiens', 'Tree', '5-8', 1, undefined, 2000),
  plant('Lemon drop mangosteen', 'Garcinia intermedia', 'Tree', undefined, 1, 'Nos', 1500),
  plant('Lemon Tree', 'Citrus lemon', 'Tree', undefined, 1, 'Nos', 850),
  plant('Jaboticaba', 'Plinia cauliflora', 'Tree', '4-8', 1, undefined, 6000),
  plant('Neem Tree', 'Azadirachta indica', 'Tree', undefined, 1, 'Nos', 1200),
]

/** A few plants from the list above, with other quantities, for the other sample projects. */
function pick(names: string[], scale: number): PlantLine[] {
  return names.map((name) => {
    const source = ASHRAF.find((p) => p.name === name)!
    serial += 1
    return { ...source, plantId: `demo-plant-${serial}`, quantity: Math.max(1, Math.round((source.quantity ?? 1) * scale)) }
  })
}

const at = (daysAgo: number) => `${addDays(today(), -daysAgo)}T10:30:00`

export const plantsProjects: PlantsProject[] = [
  {
    id: '0b6f4c1e-2a51-4f3e-9a0e-5d2c7b1a9e01', name: 'Ashraf Residence', clientName: 'Ashraf', location: 'Kondotty',
    updatedAt: at(9), locked: true, plantCount: ASHRAF.length, lines: ASHRAF,
  },
  {
    id: '1c7a5d2f-3b62-4a4f-8b1f-6e3d8c2b0f12', name: 'ABC Holdings Villa — Kowdiar', clientName: 'ABC Holdings', location: 'Kowdiar, Thiruvananthapuram',
    updatedAt: at(4), locked: false, plantCount: 0,
    lines: pick(['Swiss cheese plant', 'Boston Fern', 'Pearl Grass', 'Bird of Paradise', 'Slender lady palm', 'Muraya', 'Neem Tree'], 0.6),
  },
  {
    id: '2d8b6e3a-4c73-4b5a-9c2a-7f4e9d3c1a23', name: 'XYZ Estates Villa', clientName: 'XYZ Estates', location: 'Panampilly Nagar, Kochi',
    updatedAt: at(30), locked: true, plantCount: 0,
    lines: pick(['Fishtail Fern', 'Ribbon Grass-Green', 'Pearl Grass', 'Spider lily', 'Macarthur palm', 'Red ginger', 'Lemon Tree'], 1.2),
  },
  {
    id: '3e9c7f4b-5d84-4c6b-8d3b-8a5f0e4d2b34', name: 'DEF Resort — Kovalam', clientName: 'DEF Resorts', location: 'Kovalam',
    updatedAt: at(12), locked: false, plantCount: 0,
    lines: pick(['Bird of Paradise', 'Water heliconia', 'Torch Ginger-PINK', 'Macaw Flower', 'Macarthur palm', 'Slender lady palm', 'Pearl Grass', 'Spanish cherry', 'Ferntree'], 3),
  },
  {
    id: '4fad805c-6e95-4d7c-9e4c-9b6a1f5e3c45', name: 'Cyber Park Softscape', clientName: 'Greenfield Apartments', location: 'Kozhikode',
    updatedAt: at(2), locked: false, plantCount: 0,
    lines: pick(['Ribbon Grass-Green', 'Pearl Grass', 'Finger Arelia', 'Umbrella Papyrus; Umbrella Sedge', 'Neem Tree'], 2),
  },
  {
    id: '5abe916d-7fa6-4e8d-8f5d-0c7b2a6f4d56', name: 'Greenfield Common Area', clientName: 'Greenfield Apartments', location: 'Kozhikode',
    updatedAt: at(20), locked: false, plantCount: 0,
    lines: pick(['Boston Fern', 'Rain Lily', 'Canna lily-PINK', 'Dwarf cardamom; Shell ginger', 'Lemon drop mangosteen'], 1),
  },
  {
    id: '6bcfa27e-80b7-4f9e-9a6e-1d8c3b7a5e67', name: 'Kovalam Villa Concept', clientName: 'DEF Resorts', location: 'Kovalam',
    updatedAt: at(40), locked: false, plantCount: 0,
    lines: pick(['Swiss cheese plant', 'Calathea zebrina', 'Philodendron Selloum', 'Slender lady palm', 'Jaboticaba'], 0.5),
  },
]

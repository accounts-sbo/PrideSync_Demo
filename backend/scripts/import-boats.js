const { bulkImportBoats, initializeDatabase } = require('../src/models/database');
const logger = require('../src/services/logger');

// Pride Boat Data from CSV
const prideBoatsData = [
  { boat_number: 0, name: "Stichting Pride Amsterdam", organisation: "Stichting Pride Amsterdam", theme: "Hoofdorganisatie van de Amsterdam Pride; bevordert zichtbaarheid en rechten van LHBTIQ+ personen." },
  { boat_number: 1, name: "Spread the Word Intersex Collective", organisation: "Spread the Word Intersex Collective", theme: "Collectief dat zich inzet voor bewustwording en rechten van intersekse mensen." },
  { boat_number: 2, name: "Trans Pride powered by Rabobank", organisation: "Trans Pride powered by Rabobank", theme: "Steunt en viert de rechten en zichtbaarheid van transpersonen met Rabobank als partner." },
  { boat_number: 3, name: "Amnesty International", organisation: "Amnesty International", theme: "Internationale mensenrechtenorganisatie met focus op LHBTIQ+ rechten." },
  { boat_number: 4, name: "Roze Stadsdorp Amsterdam", organisation: "Roze Stadsdorp Amsterdam", theme: "Gemeenschap voor ouderen binnen de LHBTIQ+ gemeenschap in Amsterdam." },
  { boat_number: 5, name: "Pink Ladies", organisation: "Pink Ladies", theme: "Groep die vrouwelijke kracht en diversiteit binnen de LHBTIQ+ gemeenschap viert." },
  { boat_number: 6, name: "Ministerie van Defensie", organisation: "Ministerie van Defensie", theme: "Ondersteunt inclusiviteit en diversiteit binnen het Nederlandse leger." },
  { boat_number: 7, name: "Asian Pride by OutAsia", organisation: "Asian Pride by OutAsia", theme: "Geeft een podium aan Aziatische LHBTIQ+ mensen en hun verhalen." },
  { boat_number: 8, name: "Zonder Stempel", organisation: "Zonder Stempel", theme: "Organisatie die jongeren zonder stigmatisering ondersteunt in hun LHBTIQ+ identiteit." },
  { boat_number: 9, name: "Colourful Pride", organisation: "Colourful Pride", theme: "Celebratie van diversiteit en inclusiviteit met focus op kleurrijke expressie." },
  { boat_number: 10, name: "COC Nederland", organisation: "COC Nederland", theme: "Lief en leed delen binnen LHBTIQ+ gemeenschap door belangenbehartiging en activisme." },
  { boat_number: 11, name: "Fetish Pride", organisation: "Fetish Pride", theme: "Viering van fetisj-cultuur binnen de LHBTIQ+ gemeenschap." },
  { boat_number: 12, name: "Saints & Stars", organisation: "Saints & Stars", theme: "Community voor LHBTIQ+ personen met focus op empowerment en netwerken." },
  { boat_number: 13, name: "Provincie Noord-Holland", organisation: "Provincie Noord-Holland", theme: "Regionale overheid die LHBTIQ+ inclusie stimuleert." },
  { boat_number: 14, name: "Dolly Bellefleur", organisation: "Dolly Bellefleur", theme: "Bekende drag queen die het feestelijke Pride gevoel uitstraalt." },
  { boat_number: 15, name: "Equal Rights Coalition", organisation: "Equal Rights Coalition", theme: "Internationale coalitie voor gelijke rechten van LHBTIQ+ personen wereldwijd." },
  { boat_number: 16, name: "Gerechtshof- en rechtbank Amsterdam/Midden Nederland", organisation: "Gerechtshof- en rechtbank Amsterdam/Midden Nederland", theme: "Justitiële instanties die diversiteit en inclusie ondersteunen." },
  { boat_number: 17, name: "Café 't Achterom", organisation: "Café 't Achterom", theme: "Iconische LGBTQ+ ontmoetingsplek met een lange geschiedenis." },
  { boat_number: 18, name: "ASKV", organisation: "ASKV", theme: "Studentenorganisatie die genderdiversiteit omarmt en feestviert." },
  { boat_number: 19, name: "Blond & Blauw theater", organisation: "Blond & Blauw theater", theme: "Artistiek platform met focus op LHBTIQ+ cultuur en entertainment." },
  { boat_number: 20, name: "MADAME CLAIRE BERLIN", organisation: "MADAME CLAIRE BERLIN", theme: "Fashion en expressie met een drag-sfeer vanuit Berlijn." },
  { boat_number: 21, name: "Bi+ Nederland", organisation: "Bi+ Nederland", theme: "Steunt bisexualiteit en panseksualiteit binnen de LHBTIQ+ gemeenschap." },
  { boat_number: 22, name: "Netzo", organisation: "Netzo", theme: "Online netwerkplatform voor LHBTIQ+ jongvolwassenen." },
  { boat_number: 23, name: "Rainbow Salute Foundation", organisation: "Rainbow Salute Foundation", theme: "Foundation die LHBTIQ+ sport en cultuur bevordert." },
  { boat_number: 24, name: "RITUALS", organisation: "RITUALS", theme: "Cosmeticamerk dat inclusiviteit en zelfexpressie viert." },
  { boat_number: 25, name: "3 Layers", organisation: "3 Layers", theme: "Creatief collectief met aandacht voor diversiteit en sociale lagen." },
  { boat_number: 26, name: "Upstream Amsterdam", organisation: "Upstream Amsterdam", theme: "Community project dat jonge LHBTIQ+ leiders stimuleert." },
  { boat_number: 27, name: "Youth Pride powered by PVH Europe", organisation: "Youth Pride powered by PVH Europe", theme: "Focus op jongere generaties en hun plek binnen de LHBTIQ+ beweging." },
  { boat_number: 28, name: "Vrienden van Nieuw Unicum", organisation: "Vrienden van Nieuw Unicum", theme: "Steuntzorg en inclusie voor LHBTIQ+ ouderen." },
  { boat_number: 29, name: "BoardGayming Amsterdam", organisation: "BoardGayming Amsterdam", theme: "Game-community die diversiteit en LHBTIQ+ zichtbaarheid bevordert." },
  { boat_number: 30, name: "Gemeente Amsterdam", organisation: "Gemeente Amsterdam", theme: "Stad die openlijk LHBTIQ+ inclusie promoot." },
  { boat_number: 31, name: "Willie.nl x Satisfyer", organisation: "Willie.nl x Satisfyer", theme: "Campagne gericht op seksuele gezondheid en plezier in de LHBTIQ+ gemeenschap." },
  { boat_number: 32, name: "Love Y/OUR History", organisation: "Love Y/OUR History", theme: "Project dat LHBTIQ+ geschiedenis en verhalen deelt." },
  { boat_number: 33, name: "Tess van Zwol Pride X OUTLOUD Music Festival", organisation: "Tess van Zwol Pride X OUTLOUD Music Festival", theme: "Muziekfestival met LHBTIQ+ artiesten en aandacht voor diversiteit." },
  { boat_number: 34, name: "Travel Proud by Booking.com", organisation: "Travel Proud by Booking.com", theme: "Reisplatform dat veilige bestemmingen voor LHBTIQ+ reizigers promoot." },
  { boat_number: 35, name: "Gay Swim Nederland", organisation: "Gay Swim Nederland", theme: "Gemeenschap en evenementen rondom zwemmen voor LHBTIQ+ personen." },
  { boat_number: 36, name: "Ikwilvanmijnsoaaf.nl", organisation: "Ikwilvanmijnsoaaf.nl", theme: "Onafhankelijke organisatie gericht op seksuele gezondheid in Pride context." },
  { boat_number: 37, name: "Flirtation", organisation: "Flirtation", theme: "Sociale club die inclusie en plezier voor LHBTIQ+ bevordert." },
  { boat_number: 38, name: "Queer & Sober", organisation: "Queer & Sober", theme: "Community die sober leven binnen LHBTIQ+ aanmoedigt." },
  { boat_number: 39, name: "RTL Nederland", organisation: "RTL Nederland", theme: "Media-organisatie die inclusiviteit en LHBTIQ+ zichtbaarheid stimuleert." },
  { boat_number: 40, name: "Tommy Hilfiger", organisation: "Tommy Hilfiger", theme: "Fashionmerk met focus op diversiteit en Pride collecties." },
  { boat_number: 41, name: "Sport Pride Football Unites", organisation: "Sport Pride Football Unites", theme: "Sportinitiatief dat LHBTIQ+ inclusie in voetbal promoot." },
  { boat_number: 42, name: "Liefdessoldaten – Make Love not War", organisation: "Liefdessoldaten – Make Love not War", theme: "Campagne die liefde en vrede centraal stelt binnen Pride." },
  { boat_number: 43, name: "Cas Wolters", organisation: "Cas Wolters", theme: "Individuele deelnemer bekend voor LHBTIQ+ activisme." },
  { boat_number: 44, name: "Katja Regenboog Geluk", organisation: "Katja Regenboog Geluk", theme: "Cultuurproject met regenboogthema ter viering van geluk en diversiteit." },
  { boat_number: 45, name: "CocoLoco", organisation: "CocoLoco", theme: "Feestorganisatie die kleur en vrijheid viert." },
  { boat_number: 46, name: "Free Love On Cloud 9", organisation: "Free Love On Cloud 9", theme: "Concept rondom vrije liefde en zelfexpressie." },
  { boat_number: 47, name: "Rainbow Lions (LHBTIQ+ netwerk ING)", organisation: "Rainbow Lions (LHBTIQ+ netwerk ING)", theme: "Bedrijfsnetwerk voor LHBTIQ+ medewerkers bij ING." },
  { boat_number: 48, name: "We Are Family", organisation: "We Are Family", theme: "Community die verbondenheid binnen LHBTIQ+ benadrukt." },
  { boat_number: 49, name: "ARTIS", organisation: "ARTIS", theme: "Dierentuin die inclusieve evenementen en educatie organiseert rondom Pride." },
  { boat_number: 50, name: "HOP (LHBTIQ+ netwerk HEINEKEN)", organisation: "HOP (LHBTIQ+ netwerk HEINEKEN)", theme: "Bedrijfsnetwerk voor diversiteit en inclusie binnen HEINEKEN." },
  { boat_number: 51, name: "Roze in Blauw (Nationale Politie)", organisation: "Roze in Blauw (Nationale Politie)", theme: "Politienetwerk dat LHBTIQ+ medewerkers ondersteunt." },
  { boat_number: 52, name: "Robbers & Friends", organisation: "Robbers & Friends", theme: "Creatief bureau dat LHBTIQ+ projecten faciliteert." },
  { boat_number: 53, name: "Carbon Events", organisation: "Carbon Events", theme: "Evenementenorganisatie met focus op diversiteit." },
  { boat_number: 54, name: "Delta Air Lines X KLM", organisation: "Delta Air Lines X KLM", theme: "Luchtvaartmaatschappijen die LHBTIQ+ inclusie promoten." },
  { boat_number: 55, name: "Theaterfestival De Parade", organisation: "Theaterfestival De Parade", theme: "Cultureel festival met LHBTIQ+ betrokkenheid." },
  { boat_number: 56, name: "Amsterdam UMC x OLVG", organisation: "Amsterdam UMC x OLVG", theme: "Gezondheidsinstellingen die zich inzetten voor LHBTIQ+ patiënten." },
  { boat_number: 57, name: "Shine (LHBTIQ+ netwerk PwC)", organisation: "Shine (LHBTIQ+ netwerk PwC)", theme: "PwC-netwerk voor inclusiviteit en ondersteuning van LHBTIQ+ medewerkers." },
  { boat_number: 58, name: "A'DAM Toren", organisation: "A'DAM Toren", theme: "Iconisch gebouw in Amsterdam met Pride-evenementen." },
  { boat_number: 59, name: "Het Arbogezondheidscentrum", organisation: "Het Arbogezondheidscentrum", theme: "Gezondheidscentrum dat inclusie en welzijn bevordert." },
  { boat_number: 60, name: "Tutu Crew", organisation: "Tutu Crew", theme: "Dans- en performancegroep met kleurrijke optredens." },
  { boat_number: 61, name: "Kittylicious by Kittana", organisation: "Kittylicious by Kittana", theme: "Drag art en performance binnen de Pride community." },
  { boat_number: 62, name: "Hvoquerido", organisation: "Hvoquerido", theme: "Community die queer identiteit viert met een knipoog." },
  { boat_number: 63, name: "For All Who Love Foundation", organisation: "For All Who Love Foundation", theme: "Stichting die liefde en acceptatie promoot." },
  { boat_number: 64, name: "Aidsfonds", organisation: "Aidsfonds", theme: "NGO gericht op preventie en ondersteuning bij HIV/AIDS." },
  { boat_number: 65, name: "My sex, my way Durex", organisation: "My sex, my way Durex", theme: "Campagne rondom seksuele gezondheid en zelfbeschikking." },
  { boat_number: 66, name: "Roze in Wit", organisation: "Roze in Wit", theme: "Gezamenlijke Pride van zorginstellingen." },
  { boat_number: 67, name: "Dutch Government Pride", organisation: "Dutch Government Pride", theme: "Overheidsinitiatief voor LHBTIQ+ inclusie." },
  { boat_number: 68, name: "Vattenfall", organisation: "Vattenfall", theme: "Energiebedrijf dat diversiteit en duurzaamheid combineert." },
  { boat_number: 69, name: "De Kasteelboot", organisation: "De Kasteelboot", theme: "Boot die LHBTIQ+ events en feesten organiseert." },
  { boat_number: 70, name: "De Lesbische Liga (NTR)", organisation: "De Lesbische Liga (NTR)", theme: "Media en organisatie voor lesbische zichtbaarheid." },
  { boat_number: 71, name: "Café Montmartre", organisation: "Café Montmartre", theme: "Bekende LHBTIQ+ ontmoetingsplek in Amsterdam." },
  { boat_number: 72, name: "Het Nederlands Kanker Instituut – AVL", organisation: "Het Nederlands Kanker Instituut – AVL", theme: "Medische instelling met oog voor LHBTIQ+ patiënten." },
  { boat_number: 73, name: "Totaal Entertainment", organisation: "Totaal Entertainment", theme: "Entertainmentbedrijf met inclusieve programmering." },
  { boat_number: 74, name: "Roze in Rood (Brandweer NL)", organisation: "Roze in Rood (Brandweer NL)", theme: "Brandweer-initiatief dat diversiteit binnen het korps ondersteunt." },
  { boat_number: 75, name: "Unity for the community (D66, PvdA, CDA, VVD en VOLT)", organisation: "Unity for the community (D66, PvdA, CDA, VVD en VOLT)", theme: "Politieke samenwerking ter ondersteuning van LHBTIQ+ rechten." },
  { boat_number: 76, name: "Roze Zaterdag 2026 Noordwijk", organisation: "Roze Zaterdag 2026 Noordwijk", theme: "Organisatie van het Roze Zaterdag evenement in Noordwijk 2026." },
  { boat_number: 77, name: "AVROTROS", organisation: "AVROTROS", theme: "Omroep die LHBTIQ+ verhalen uitzendt en ondersteunt." },
  { boat_number: 78, name: "Pride @Google", organisation: "Pride @Google", theme: "Google-netwerk voor inclusie en LHBTIQ+ medewerkers." },
  { boat_number: 79, name: "Technische Universiteit Delft", organisation: "Technische Universiteit Delft", theme: "Academische instelling met LHBTIQ+ studentenvereniging." },
  { boat_number: 80, name: "A.S.V.Gay", organisation: "A.S.V.Gay", theme: "Studentenvereniging voor LHBTIQ+ aan de TU Delft." }
];

async function importBoats() {
  try {
    logger.info('🚀 Starting boat data import...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Import boats
    const result = await bulkImportBoats(prideBoatsData);
    
    logger.info(`✅ Successfully imported ${result.length} boats`);
    logger.info('📊 Import summary:', {
      total: result.length,
      first_boat: result[0]?.name,
      last_boat: result[result.length - 1]?.name
    });
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Error importing boats:', error);
    process.exit(1);
  }
}

// Run import if called directly
if (require.main === module) {
  importBoats();
}

module.exports = { importBoats, prideBoatsData };

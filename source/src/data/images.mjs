// Every photograph used on the site, extracted from the 2026 Company Profile (Edition 2026, Version 5).
// crop: [x, y, width, height] in source pixels, chosen to keep faces whole and to cut away the
//       white fades that the profile layout baked into some images.
// ratio: one of the fixed set 3:4, 4:5, 16:9, 21:9 (the licence is a document and keeps its own shape).
// focus: object-position used when the browser has to crop further.
// grade: false leaves the colours untouched (used for the licence document).
// page:  the profile page the image comes from.

export const images = {
  'banknote-hands': {
    file: 'banknote-hands.jpg', page: 1, ratio: '16:9', crop: [25, 0, 3115, 1752], focus: '50% 50%',
    alt: 'Two hands passing a UGX 50,000 banknote between them',
  },
  'team-group': {
    file: 'team-group.jpg', page: 5, ratio: '16:9', crop: [0, 40, 1370, 770], focus: '50% 30%',
    alt: 'The Biashara team standing together at the Kampala office',
  },
  'md-about': {
    file: 'md-about.jpg', page: 7, ratio: '3:4', crop: [0, 0, 754, 1005], focus: '50% 30%',
    alt: 'Managing Director Modest Rutagengwa',
  },
  'john-tasi-mufumba': {
    file: 'john-tasi-mufumba.jpg', page: 10, ratio: '3:4', crop: [14, 0, 433, 578], focus: '50% 30%',
    alt: 'Chairman, Board of Directors John Tasi Mufumba',
  },
  'modest-rutagengwa': {
    file: 'modest-rutagengwa.jpg', page: 10, ratio: '3:4', crop: [10, 0, 424, 566], focus: '50% 30%',
    alt: 'Managing Director Modest Rutagengwa',
  },
  'felix-omunu': {
    file: 'felix-omunu.jpg', page: 10, ratio: '3:4', crop: [14, 0, 433, 578], focus: '50% 30%',
    alt: 'Board Secretary Felix Omunu',
  },
  'stephen-kwesiga': {
    file: 'stephen-kwesiga.jpg', page: 10, ratio: '3:4', crop: [0, 4, 306, 408], focus: '50% 30%', reconstructed: true,
    alt: 'Finance & Systems Consultant Stephen Kwesiga (portrait reconstructed from supplied references)',
  },
  'bernadette-mugisha': {
    file: 'bernadette-mugisha.jpg', page: 10, ratio: '3:4', crop: [0, 4, 293, 391], focus: '50% 30%', reconstructed: true,
    alt: 'HR Partner Bernadette Mugisha (portrait reconstructed from supplied references)',
  },
  'arthur-mbabazi-birohozo': {
    file: 'arthur-mbabazi-birohozo.jpg', page: 11, ratio: '3:4', crop: [18, 0, 342, 456], focus: '50% 30%',
    alt: 'Branch Manager Arthur Mbabazi Birohozo',
  },
  'phiona-twahirwa': {
    file: 'phiona-twahirwa.jpg', page: 11, ratio: '3:4', crop: [18, 0, 355, 474], focus: '50% 30%',
    alt: 'Assistant Accountant Phiona M. Twahirwa',
  },
  'hope-masika-gladys': {
    file: 'hope-masika-gladys.jpg', page: 11, ratio: '3:4', crop: [19, 0, 374, 499], focus: '50% 30%',
    alt: 'Credit Officer Hope Masika Gladys',
  },
  'miriam-kalembe': {
    file: 'miriam-kalembe.jpg', page: 11, ratio: '3:4', crop: [17, 0, 327, 436], focus: '50% 30%',
    alt: 'Support Staff Miriam Kalembe',
  },
  'hakim-asiimwe-bowazi': {
    file: 'hakim-asiimwe-bowazi.jpg', page: 11, ratio: '3:4', crop: [21, 0, 413, 551], focus: '50% 30%',
    alt: 'Support Staff Hakim Asiimwe Bowazi',
  },
  'what-we-offer': {
    file: 'what-we-offer.jpg', page: 12, ratio: '4:5', crop: [0, 0, 1468, 1835], focus: '60% 35%',
    alt: 'A woman at work in a clothing workshop',
  },
  'real-enterprise': {
    file: 'real-enterprise.jpg', page: 13, ratio: '21:9', crop: [300, 70, 831, 356], focus: '30% 40%',
    alt: 'A man in a timber workshop',
  },
  'vehicle-acquisition': {
    file: 'vehicle-acquisition.jpg', page: 16, ratio: '21:9', crop: [100, 60, 1090, 467], focus: '30% 50%',
    alt: 'Car keys being handed over beside a red pickup on a vehicle lot',
  },
  'stock-cash-flow': {
    file: 'stock-cash-flow.jpg', page: 16, ratio: '21:9', crop: [150, 60, 1087, 466], focus: '30% 50%',
    alt: 'A shop owner watching stock being loaded from a van',
  },
  'salaried-clients': {
    file: 'salaried-clients.jpg', page: 17, ratio: '4:5', crop: [100, 0, 558, 698], focus: '50% 35%',
    alt: 'A woman in a dark blazer reading at her desk',
  },
  'emerging-entrepreneurs': {
    file: 'emerging-entrepreneurs.jpg', page: 17, ratio: '4:5', crop: [0, 0, 714, 893], focus: '30% 35%',
    alt: 'A man reviewing papers in a print workshop',
  },
  'how-we-work': {
    file: 'how-we-work.jpg', page: 18, ratio: '16:9', crop: [0, 40, 1369, 770], focus: '50% 30%',
    alt: 'Three Biashara colleagues standing together',
  },
  'discussion-1': { file: 'discussion-1.jpg', page: 19, ratio: '4:5', crop: [52, 0, 372, 465], focus: '50% 35%', alt: 'A Biashara colleague in a team discussion' },
  'discussion-2': { file: 'discussion-2.jpg', page: 19, ratio: '4:5', crop: [52, 0, 372, 465], focus: '50% 35%', alt: 'A Biashara colleague in a team discussion' },
  'discussion-3': { file: 'discussion-3.jpg', page: 19, ratio: '4:5', crop: [52, 0, 372, 465], focus: '50% 35%', alt: 'A Biashara colleague in a team discussion' },
  'file-review': {
    file: 'file-review.jpg', page: 21, ratio: '21:9', crop: [120, 70, 2042, 875], focus: '55% 40%',
    alt: 'A Biashara colleague reviewing a file at a laptop beside the company vision board',
  },
  'clear-conversations': {
    file: 'clear-conversations.jpg', page: 22, ratio: '21:9', crop: [720, 40, 873, 374], focus: '50% 40%',
    alt: 'Three people in a meeting reviewing documents',
  },
  'hope-masika-gladys-desk': {
    file: 'hope-masika-gladys-desk.jpg', page: 23, ratio: '4:5', crop: [8, 0, 577, 721], focus: '50% 30%',
    alt: 'Credit Officer Hope Masika Gladys',
  },
  'licence-2026': {
    file: 'licence-2026.jpg', page: 24, ratio: 'native', crop: [0, 0, 879, 1280], focus: '50% 50%', grade: false,
    alt: 'The 2026 Money Lending Licence certificate, number 1451/ML, issued to Biashara Trading Company Limited',
  },
  'colleagues-office': {
    file: 'colleagues-office.jpg', page: 25, ratio: '16:9', crop: [0, 30, 1280, 720], focus: '50% 30%',
    alt: 'Biashara colleagues at the Kampala office',
  },
};

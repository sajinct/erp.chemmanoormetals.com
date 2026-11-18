-- Starting data. Rates are zero until the real rate list is imported from Excel.
-- Bank details, GSTIN and email are left blank for the admin to fill in Settings.

insert into public.settings (
  id, company_name, address, phone, quote_terms, msg_measurement, msg_quote, msg_receipt
) values (
  1,
  'Chemmanoor Metals',
  'Perakam P.O, Chavakkad Via, Thrissur, Kerala 680505',
  '+91 97470 70066',
  E'1. 50% advance with the order; balance before delivery.\n2. Delivery and installation dates are confirmed after the advance is received.\n3. Prices are valid until the date shown on this quotation.\n4. Civil and electrical work at site is not included unless listed above.',
  E'Dear {name},\n\nPlease confirm the final measurements for your order {ref} (revision R{revision}):\n\n{items}\n\nReply YES to confirm so that we can prepare your quotation.\n\n{company}',
  E'Dear {name},\n\nPlease find the quotation {quote_no} for {ref}.\nTotal: Rs. {total}\nValid until: {valid_until}\n{link}\n\nBank details for the advance:\n{bank}\n\n{company}',
  E'Dear {name},\n\nWe have received Rs. {amount} by {mode} on {date} towards {ref}. Thank you.\nBalance: Rs. {balance}\n\n{company}'
);

insert into public.products (category, name, unit) values
  ('shutter', 'Aluminium shutter', 'sqft'),
  ('shutter', 'Transparent (polycarbonate) shutter', 'sqft'),
  ('shutter', 'Garage shutter', 'sqft'),
  ('shutter', 'Window shutter', 'sqft'),
  ('shutter', 'Grill rolling shutter', 'sqft'),
  ('shutter', 'Gear-operated shutter', 'sqft'),
  ('perforated', 'Perforated shutter', 'sqft'),
  ('accessory', 'Side motor', 'nos'),
  ('accessory', 'Centre motor', 'nos'),
  ('accessory', 'Tubular motor', 'nos'),
  ('accessory', 'Remote control', 'nos'),
  ('gate', 'Swing gate automation (arm)', 'nos'),
  ('gate', 'Swing gate automation (roller)', 'nos'),
  ('gate', 'Sliding gate automation', 'nos'),
  ('gate', 'Telescopic gate automation', 'nos'),
  ('pergola', 'Moving pergola roof', 'sqft'),
  ('service', 'Powder coating', 'sqft'),
  ('service', 'Installation', 'lot'),
  ('service', 'Transport', 'lot');

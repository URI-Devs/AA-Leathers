-- ============================================================
-- OPTIONAL SAMPLE DATA (run SECOND, only if you want the demo catalog)
-- You can edit/delete all of this later from the Admin → Inventory page.
-- The delivery charges are REQUIRED for checkout to work — keep them
-- (change the amounts/regions from Admin → Dashboard → Delivery Charges).
-- ============================================================
insert into public.categories (category_id, name) values
  ('cat-bifold','Bifold Wallets'), ('cat-cardholder','Card Holders'),
  ('cat-travel','Travel Wallets'), ('cat-slim','Slim Wallets');

insert into public.products (product_id, name, article_no, category_id, description, price, variants, images, active) values
 ('AA101','Classic Leather Wallet','AA101','cat-bifold','Genuine leather bifold wallet with multiple card slots and a coin pocket. Hand-finished edges and a timeless silhouette.',2500,
  '[{"variantID":"v1","color":"Black","size":"Standard","stock":12,"image":""},{"variantID":"v2","color":"Brown","size":"Standard","stock":9,"image":""},{"variantID":"v3","color":"Dark Brown","size":"Standard","stock":6,"image":""}]','[]',true),
 ('AA102','Black Bifold Wallet','AA102','cat-bifold','A sleek all-black bifold with a minimalist front pocket and six card slots.',2800,
  '[{"variantID":"v1","color":"Black","size":"Standard","stock":15,"image":""}]','[]',true),
 ('AA103','Dark Brown Cardholder','AA103','cat-cardholder','A slim cardholder for the essentials — four card slots and a central pull-tab.',1800,
  '[{"variantID":"v1","color":"Dark Brown","size":"Standard","stock":20,"image":""},{"variantID":"v2","color":"Tan","size":"Standard","stock":11,"image":""}]','[]',true),
 ('AA104','Slim Travel Wallet','AA104','cat-travel','Built for travel — a passport sleeve, boarding-pass pocket, and RFID-safe card slots.',3200,
  '[{"variantID":"v1","color":"Brown","size":"Standard","stock":7,"image":""},{"variantID":"v2","color":"Black","size":"Standard","stock":5,"image":""}]','[]',true),
 ('AA105','Slim Front-Pocket Wallet','AA105','cat-slim','A featherweight slim wallet designed to sit flat in a front pocket.',2100,
  '[{"variantID":"v1","color":"Black","size":"Standard","stock":14,"image":""},{"variantID":"v2","color":"Brown","size":"Standard","stock":10,"image":""}]','[]',true),
 ('AA106','Tan Long Wallet','AA106','cat-bifold','A longline wallet with a zip coin pouch and eight card slots.',3500,
  '[{"variantID":"v1","color":"Tan","size":"Standard","stock":8,"image":""}]','[]',true);

insert into public.delivery_charges (charge_id, region, amount) values
  ('dc-1','Sahiwal City',150), ('dc-2','Other Cities (Punjab)',250), ('dc-3','Rest of Pakistan',350);

-- NOTE: no fake reviews are inserted on purpose — fake reviews on a real shop
-- are misleading. Real customers can review products after they order them.

-- ============================================================
-- SEED DATA: Fake media records for development
-- Run AFTER registering at least one user account.
-- All records are assigned to the first profile found.
-- ============================================================

do $$
declare
  _user_id uuid;
begin
  -- Grab the first registered user
  select id into _user_id from public.profiles order by created_at limit 1;

  if _user_id is null then
    raise exception 'No profiles found. Register a user account first, then run this migration.';
  end if;

  -- ============================================================
  -- VINYL RECORDS
  -- ============================================================
  insert into public.media (id, created_by, media_type, title, artist, label, year, genres, location, condition, notes) values
  (gen_random_uuid(), _user_id, 'vinyl', 'Kind of Blue', 'Miles Davis', 'Columbia', 1959, '{"Jazz","Modal Jazz"}', 'Shelf A-1', 'near-mint', 'Original mono pressing. Sleeve has minor ring wear.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'A Love Supreme', 'John Coltrane', 'Impulse!', 1965, '{"Jazz","Spiritual Jazz"}', 'Shelf A-1', 'excellent', 'Gatefold edition, insert included.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'Rumours', 'Fleetwood Mac', 'Warner Bros.', 1977, '{"Rock","Pop Rock"}', 'Shelf B-2', 'good', 'Inner sleeve has some writing. Plays great.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'Purple Rain', 'Prince and the Revolution', 'Warner Bros.', 1984, '{"Pop","Funk","Rock"}', 'Shelf B-3', 'near-mint', 'Poster included. Shrink wrap partially intact.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'Appetite for Destruction', 'Guns N'' Roses', 'Geffen', 1987, '{"Hard Rock","Rock"}', 'Shelf C-1', 'good', 'Original banned cover art. Some surface noise on side B.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'The Miseducation of Lauryn Hill', 'Lauryn Hill', 'Ruffhouse', 1998, '{"R&B","Hip Hop","Neo-Soul"}', 'Shelf D-2', 'excellent', 'Double LP, gatefold. Clean copy.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'In the Aeroplane Over the Sea', 'Neutral Milk Hotel', 'Merge', 1998, '{"Indie Rock","Lo-Fi"}', 'Shelf D-3', 'mint', 'Sealed 2009 repress. Never played.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'Blonde', 'Frank Ocean', 'Boys Don''t Cry', 2016, '{"R&B","Art Pop","Alternative"}', 'Shelf E-1', 'near-mint', 'Black Friday edition. Played twice.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'Titanic Rising', 'Weyes Blood', 'Sub Pop', 2019, '{"Art Pop","Dream Pop","Baroque Pop"}', 'Shelf E-2', 'mint', 'Clear vinyl variant. Still sealed.'),
  (gen_random_uuid(), _user_id, 'vinyl', 'Bitches Brew', 'Miles Davis', 'Columbia', 1970, '{"Jazz","Fusion","Experimental"}', 'Shelf A-2', 'fair', 'Double LP. Scratches on disc 2 but still playable. Historic pressing.');

  -- ============================================================
  -- 45 RPM SINGLES
  -- ============================================================
  insert into public.media (id, created_by, media_type, title, artist, label, year, genres, location, condition, notes) values
  (gen_random_uuid(), _user_id, '45', 'Respect', 'Aretha Franklin', 'Atlantic', 1967, '{"Soul","R&B"}', 'Bin 1', 'good', 'B-side is "Dr. Feelgood". Label has some wear.'),
  (gen_random_uuid(), _user_id, '45', 'Blinding Lights', 'The Weeknd', 'XO', 2019, '{"Synthpop","Pop"}', 'Bin 1', 'mint', 'Limited press, picture sleeve.'),
  (gen_random_uuid(), _user_id, '45', 'Heart of Glass', 'Blondie', 'Chrysalis', 1979, '{"Disco","New Wave"}', 'Bin 2', 'excellent', 'Original US pressing. Clean grooves.'),
  (gen_random_uuid(), _user_id, '45', 'Blue Monday', 'New Order', 'Factory', 1983, '{"Electronic","Synth-Pop"}', 'Bin 2', 'near-mint', 'Die-cut sleeve. Iconic.'),
  (gen_random_uuid(), _user_id, '45', 'Jolene', 'Dolly Parton', 'RCA', 1973, '{"Country","Folk"}', 'Bin 3', 'good', 'Promo copy with timing strip on label.');

  -- ============================================================
  -- CDs
  -- ============================================================
  insert into public.media (id, created_by, media_type, title, artist, label, year, genres, location, condition, notes) values
  (gen_random_uuid(), _user_id, 'cd', 'OK Computer', 'Radiohead', 'Capitol', 1997, '{"Alternative Rock","Art Rock"}', 'Rack 1-A', 'excellent', 'Jewel case, booklet intact. Disc is flawless.'),
  (gen_random_uuid(), _user_id, 'cd', 'Dummy', 'Portishead', 'Go! Beat', 1994, '{"Trip-Hop","Electronic","Downtempo"}', 'Rack 1-A', 'near-mint', 'Import edition with bonus track.'),
  (gen_random_uuid(), _user_id, 'cd', 'Nevermind', 'Nirvana', 'DGC', 1991, '{"Grunge","Alternative Rock"}', 'Rack 1-B', 'good', 'Case has a crack but disc plays perfectly.'),
  (gen_random_uuid(), _user_id, 'cd', 'Ctrl', 'SZA', 'Top Dawg', 2017, '{"R&B","Neo-Soul","Pop"}', 'Rack 2-A', 'mint', 'Deluxe edition with 4 bonus tracks. Unopened.'),
  (gen_random_uuid(), _user_id, 'cd', 'Homogenic', 'Bjork', 'One Little Independent', 1997, '{"Electronic","Art Pop","Experimental"}', 'Rack 2-B', 'excellent', 'Digipak in great condition.'),
  (gen_random_uuid(), _user_id, 'cd', 'Vespertine', 'Bjork', 'One Little Independent', 2001, '{"Electronic","Glitch","Art Pop"}', 'Rack 2-B', 'near-mint', 'Special edition with lenticular cover.'),
  (gen_random_uuid(), _user_id, 'cd', 'Enter the Wu-Tang (36 Chambers)', 'Wu-Tang Clan', 'Loud', 1993, '{"Hip Hop","East Coast","Hardcore Hip Hop"}', 'Rack 3-A', 'good', 'Disc has light scratches, no skipping.'),
  (gen_random_uuid(), _user_id, 'cd', 'The Low End Theory', 'A Tribe Called Quest', 'Jive', 1991, '{"Hip Hop","Jazz Rap"}', 'Rack 3-A', 'excellent', 'Clean disc. Booklet has all pages.'),
  (gen_random_uuid(), _user_id, 'cd', 'Lemonade', 'Beyonce', 'Parkwood', 2016, '{"R&B","Pop","Art Pop"}', 'Rack 3-B', 'mint', 'CD + DVD combo. Sealed.'),
  (gen_random_uuid(), _user_id, 'cd', 'Punisher', 'Phoebe Bridgers', 'Dead Oceans', 2020, '{"Indie Rock","Indie Folk","Sadcore"}', 'Rack 4-A', 'mint', 'Signed insert from record store event.');

end;
$$;

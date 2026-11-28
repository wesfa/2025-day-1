// Smart grocery list: what to buy this week, picked from a catalog of healthy staples and tilted toward whatever
// your last 7 days of logging were missing (or overdoing). Too much sodium -> low-sodium whole foods and
// potassium-rich produce; short on protein -> lean meats, Greek yogurt, protein powder; few fruits and veggies ->
// more produce; lots of fast food and snacks -> real food that's easy to make; short on calories while bulking ->
// calorie-dense healthy foods. Quantities scale with your protein and calorie targets.
//
// Each item has a plain description to spot it on the shelf, for Wegmans (first choice), Aldi (second) or any
// store. Aldi names use its store brands (Kirkwood chicken, Friendly Farms dairy, Goldhen eggs, Millville oats...).
import { S, getFood, targets, totals } from './store.js';
import { dayKey, addDays } from './util.js';
import { paceStatus } from './weight.js';

export const STORES = [['wegmans', 'Wegmans'], ['tj', 'Trader Joe\'s'], ['aldi', 'Aldi'], ['any', 'Any store']];
export const SECTIONS = ['Meat & Fish', 'Dairy & Eggs', 'Produce', 'Frozen', 'Bread & Grains', 'Pantry', 'Snacks', 'Supplements'];

// srv + nutrition per serving (approx): cal, p, c, f, fib, na, pot
// tags (0-1): prot, lean, lowna (1 = almost no sodium, negative = salty), fib, pot, cal (calorie-dense), fruit, veg,
// dairy, carb, fat (healthy fats), whole (real food), quick (packaged, ready in minutes - as easy as takeout), cheap.
// base = how much it belongs on any athlete's list.
// q = weekly amount for a ~200 g protein / 3,000 kcal eater, unit, scale ('p' protein target, 'cal' calories, '' fixed)
const I = (id, sec, name, w, a, any, srv, n, tags, base, q, unit, scale = '') => ({ id, sec, name, w, a, any, srv, n, tags, base, q, unit, scale });
export const CATALOG = [
  // ---- Meat & Fish ----
  I('chicken-breast', 'Meat & Fish', 'Chicken breasts', 'Wegmans Boneless Skinless Chicken Breasts, family pack', 'Kirkwood Fresh Boneless Skinless Chicken Breasts', 'Boneless skinless chicken breasts (fresh, plain - not breaded or marinated)',
    '4 oz cooked', [187, 35, 0, 4, 0, 85, 290], { prot: 1, lean: 1, lowna: 1, whole: 1 }, 3, 3, 'lb', 'p'),
  I('chicken-thighs', 'Meat & Fish', 'Chicken thighs', 'Wegmans Boneless Skinless Chicken Thighs, family pack', 'Kirkwood Fresh Boneless Skinless Chicken Thighs', 'Boneless skinless chicken thighs',
    '4 oz cooked', [205, 28, 0, 9, 0, 95, 270], { prot: 0.8, lowna: 1, cal: 0.4, cheap: 0.8, whole: 1 }, 1, 2, 'lb', 'p'),
  I('beef-93', 'Meat & Fish', '93% lean ground beef', 'Wegmans 93% Lean Ground Beef, 1 lb pack', 'Aldi 93% Lean Ground Beef, 1 lb pack (meat case)', '93% lean ground beef',
    '4 oz cooked', [210, 29, 0, 10, 0, 85, 420], { prot: 0.9, lean: 0.8, lowna: 1, whole: 1 }, 2, 2, 'lb', 'p'),
  I('turkey-93', 'Meat & Fish', '93% lean ground turkey', 'Wegmans 93% Lean Ground Turkey, 1 lb pack', 'Aldi 93/7 Lean Ground Turkey, 1 lb pack (meat case)', '93/7 lean ground turkey',
    '4 oz cooked', [200, 25, 0, 11, 0, 100, 330], { prot: 0.8, lean: 0.7, lowna: 1, whole: 1 }, 0.5, 1, 'lb', 'p'),
  I('salmon', 'Meat & Fish', 'Salmon', 'Wegmans Atlantic Salmon fillet (seafood counter) or Wegmans frozen salmon portions', 'Fremont Fish Market Frozen Atlantic Salmon Fillets', 'Salmon fillets (fresh or frozen, unseasoned)',
    '4 oz cooked', [233, 25, 0, 14, 0, 70, 435], { prot: 0.8, fat: 1, lowna: 1, pot: 0.5, whole: 1 }, 1, 1, 'lb', 'p'),
  I('shrimp', 'Meat & Fish', 'Frozen shrimp', 'Wegmans Frozen Raw Shrimp, peeled & deveined', 'Fremont Fish Market Frozen Raw Shrimp', 'Frozen raw shrimp, peeled & deveined',
    '4 oz', [112, 27, 0, 1, 0, 300, 190], { prot: 0.9, lean: 1, lowna: 0.4 }, 0, 1, 'bag'),
  I('tuna', 'Meat & Fish', 'Canned tuna', 'Wegmans Chunk Light Tuna in Water, 5 oz cans', 'Northern Catch Chunk Light Tuna in Water, 5 oz cans', 'Chunk light tuna in water, 5 oz cans',
    '1 can', [120, 26, 0, 1, 0, 350, 330], { prot: 1, lean: 1, cheap: 1, lowna: 0.3 }, 1, 4, 'can', 'p'),
  // ---- Dairy & Eggs ----
  I('eggs', 'Dairy & Eggs', 'Eggs', 'Wegmans Large Grade A Eggs, 18 count', 'Goldhen Large Grade A Eggs, 18 count', 'Large eggs, 18 count',
    '3 eggs', [216, 18, 1, 15, 0, 210, 210], { prot: 0.7, cheap: 1, lowna: 0.8, cal: 0.3, whole: 1 }, 2, 1, 'carton', 'p'),
  I('greek-yogurt', 'Dairy & Eggs', 'Plain Greek yogurt', 'Wegmans Plain Nonfat Greek Yogurt, 32 oz tub', 'Friendly Farms Plain Nonfat Greek Yogurt, 32 oz tub', 'Plain nonfat Greek yogurt, 32 oz tub',
    '1 cup', [130, 23, 9, 0, 0, 85, 320], { prot: 0.9, dairy: 1, lean: 1, lowna: 1, pot: 0.4 }, 2, 2, 'tub', 'p'),
  I('cottage-cheese', 'Dairy & Eggs', 'Cottage cheese', 'Wegmans 2% Lowfat Cottage Cheese, 24 oz', 'Friendly Farms 2% Lowfat Cottage Cheese, 24 oz', '2% cottage cheese, 24 oz',
    '1 cup', [180, 24, 10, 5, 0, 700, 280], { prot: 1, dairy: 0.8, lowna: -0.5 }, 1, 1, 'tub', 'p'),
  I('milk', 'Dairy & Eggs', 'Milk', 'Wegmans Whole Milk, 1 gallon', 'Friendly Farms Whole Milk, 1 gallon', 'Whole milk, 1 gallon',
    '1 cup', [150, 8, 12, 8, 0, 105, 320], { dairy: 1, cal: 0.6, pot: 0.5, prot: 0.3, lowna: 0.8, cheap: 0.8 }, 1.5, 1, 'gallon', 'cal'),
  I('uf-milk', 'Dairy & Eggs', 'Ultra-filtered milk', 'fairlife 2% Ultra-Filtered Milk, 52 oz (dairy case)', 'Ultra-filtered milk, 52 oz (Aldi has a store brand some weeks)', 'fairlife 2% Ultra-Filtered Milk, 52 oz',
    '1 cup', [120, 13, 6, 4.5, 0, 120, 400], { prot: 0.7, dairy: 1, lean: 0.6, lowna: 0.8 }, 0.5, 1, 'bottle'),
  I('choc-milk', 'Dairy & Eggs', 'Chocolate milk', 'Wegmans Lowfat Chocolate Milk, half gallon', 'Friendly Farms Lowfat Chocolate Milk, half gallon', 'Lowfat chocolate milk, half gallon',
    '1 cup', [160, 8, 26, 3, 1, 160, 425], { carb: 0.5, dairy: 0.8, prot: 0.3, pot: 0.5, lowna: 0.7 }, 0, 1, 'half gallon'),
  // ---- Produce ----
  I('bananas', 'Produce', 'Bananas', 'Bananas, 1 bunch', 'Bananas, 1 bunch', 'Bananas, 1 bunch',
    '1 banana', [105, 1, 27, 0, 3, 1, 420], { fruit: 1, pot: 1, carb: 0.6, cheap: 1, lowna: 1, whole: 1 }, 2, 2, 'bunch', 'cal'),
  I('apples', 'Produce', 'Apples', 'Apples, 3 lb bag (Honeycrisp, Gala or Fuji)', 'Apples, 3 lb bag', 'Apples, 3 lb bag',
    '1 apple', [95, 0, 25, 0, 4.4, 2, 195], { fruit: 1, fib: 0.6, lowna: 1, whole: 1 }, 1, 1, 'bag'),
  I('clementines', 'Produce', 'Clementines', 'Clementines, 3 lb bag', 'Clementines, 3 lb bag', 'Clementines or oranges, 3 lb bag',
    '2 clementines', [70, 1, 18, 0, 2.6, 2, 260], { fruit: 1, pot: 0.4, lowna: 1, whole: 1 }, 0.8, 1, 'bag'),
  I('spinach', 'Produce', 'Baby spinach', 'Wegmans Organic Baby Spinach, 16 oz tub', 'Simply Nature Organic Baby Spinach (bagged salad section)', 'Baby spinach, 16 oz tub',
    '2 cups', [14, 2, 2, 0, 1.3, 48, 330], { veg: 1, pot: 0.7, fib: 0.3, lowna: 1, whole: 1 }, 1, 1, 'tub'),
  I('sweet-potatoes', 'Produce', 'Sweet potatoes', 'Sweet potatoes, 3 lb bag', 'Sweet potatoes, 3 lb bag', 'Sweet potatoes, 3 lb bag',
    '1 medium', [112, 2, 26, 0, 3.9, 72, 440], { veg: 0.5, carb: 0.9, pot: 1, fib: 0.7, lowna: 1, whole: 1 }, 1.5, 1, 'bag', 'cal'),
  I('potatoes', 'Produce', 'Russet potatoes', 'Wegmans Russet Potatoes, 5 lb bag', 'Russet Potatoes, 5 lb bag', 'Russet potatoes, 5 lb bag',
    '1 medium', [160, 4, 37, 0, 3.8, 17, 925], { carb: 1, pot: 1, cal: 0.4, cheap: 1, lowna: 1, whole: 1 }, 1, 1, 'bag'),
  I('avocados', 'Produce', 'Avocados', 'Avocados, bag of 4-5', 'Avocados, bag', 'Avocados, bag',
    '1/2 avocado', [120, 1.5, 6, 11, 5, 5, 490], { fat: 1, pot: 0.8, fib: 0.6, cal: 0.5, lowna: 1, whole: 1 }, 0.8, 1, 'bag'),
  I('carrots', 'Produce', 'Baby carrots', 'Wegmans Baby Carrots, 1 lb bag', 'Baby Carrots, 1 lb bag', 'Baby carrots, 1 lb bag',
    '1 cup', [50, 1, 12, 0, 3.4, 88, 390], { veg: 1, fib: 0.4, pot: 0.4, cheap: 1, lowna: 0.9, whole: 1 }, 0.8, 1, 'bag'),
  // ---- Frozen ----
  I('broccoli', 'Frozen', 'Frozen broccoli', 'Wegmans Frozen Broccoli Florets (steam-in-bag)', "Season's Choice Frozen Broccoli Florets (steamable bag)", 'Frozen broccoli florets, steam-in-bag (no sauce)',
    '1 cup', [30, 3, 5, 0, 2.6, 30, 290], { veg: 1, fib: 0.6, pot: 0.4, lowna: 1, cheap: 1, whole: 1 }, 1.5, 2, 'bag'),
  I('mixed-veg', 'Frozen', 'Frozen mixed vegetables', 'Wegmans Frozen Mixed Vegetables (plain, no sauce)', "Season's Choice Frozen Mixed Vegetables", 'Frozen mixed vegetables (plain, no sauce)',
    '1 cup', [80, 4, 16, 0, 4, 60, 300], { veg: 1, fib: 0.6, lowna: 1, cheap: 1, whole: 1 }, 1, 1, 'bag'),
  I('berries', 'Frozen', 'Frozen berries', 'Wegmans Frozen Mixed Berries (or blueberries)', 'Aldi Frozen Mixed Berries (frozen fruit section)', 'Frozen mixed berries, no sugar added',
    '1 cup', [70, 1, 17, 0.5, 4, 1, 120], { fruit: 1, fib: 0.8, lowna: 1, whole: 1 }, 1, 1, 'bag'),
  // ---- Bread & Grains ----
  I('oats', 'Bread & Grains', 'Old fashioned oats', 'Wegmans Old Fashioned Rolled Oats, 42 oz canister', 'Millville Old Fashioned Oats, 42 oz canister', 'Old fashioned rolled oats, 42 oz canister',
    '1/2 cup dry', [150, 5, 27, 3, 4, 0, 150], { carb: 1, fib: 0.8, cal: 0.6, lowna: 1, cheap: 1, whole: 1 }, 2, 1, 'canister'),
  I('rice', 'Bread & Grains', 'Rice', 'Wegmans Jasmine Rice or Long Grain White Rice, 5 lb bag', 'Earthly Grains Jasmine Rice', 'Jasmine or long grain white rice, 5 lb bag',
    '1 cup cooked', [205, 4, 45, 0, 0.6, 0, 55], { carb: 1, cal: 0.7, lowna: 1, cheap: 1 }, 1.5, 1, 'bag'),
  I('ww-bread', 'Bread & Grains', 'Whole wheat bread', 'Wegmans 100% Whole Wheat Bread', "L'oven Fresh 100% Whole Wheat Bread", '100% whole wheat bread',
    '2 slices', [160, 8, 28, 2, 4, 300, 200], { carb: 0.7, fib: 0.6, lowna: 0.2, cheap: 0.8 }, 1, 1, 'loaf'),
  I('bagels', 'Bread & Grains', 'Plain bagels', 'Wegmans Plain Bagels, 6 pack', "L'oven Fresh Plain Bagels, 6 pack", 'Plain bagels, 6 pack',
    '1 bagel', [270, 10, 53, 1.5, 2, 430, 100], { carb: 1, cal: 0.7, lowna: -0.2 }, 0.5, 1, 'pack'),
  I('ww-pasta', 'Bread & Grains', 'Whole wheat pasta', 'Wegmans Whole Wheat Penne', 'Reggano Whole Wheat Spaghetti', 'Whole wheat pasta, 1 lb box',
    '2 oz dry', [180, 8, 39, 1.5, 6, 0, 180], { carb: 1, fib: 0.7, cal: 0.5, lowna: 1, cheap: 1 }, 1, 2, 'box'),
  // ---- Pantry ----
  I('peanut-butter', 'Pantry', 'Natural peanut butter', 'Wegmans Natural Creamy Peanut Butter (peanuts + salt only)', 'Simply Nature Organic Creamy Peanut Butter', 'Natural peanut butter (ingredients: peanuts, salt)',
    '2 tbsp', [190, 7, 7, 16, 2, 140, 200], { cal: 1, fat: 0.8, prot: 0.2, lowna: 0.7, cheap: 0.8 }, 1, 1, 'jar'),
  I('mixed-nuts', 'Pantry', 'Unsalted mixed nuts', 'Wegmans Unsalted Mixed Nuts', 'Southern Grove Unsalted Mixed Nuts', 'Unsalted mixed nuts',
    '1/4 cup', [200, 6, 7, 18, 2, 0, 200], { cal: 1, fat: 1, lowna: 1 }, 0.6, 1, 'can'),
  I('black-beans', 'Pantry', 'Black beans', 'Wegmans No Salt Added Black Beans, 15 oz cans', "Dakota's Pride Black Beans, 15 oz cans (pick low sodium if there)", 'No salt added black beans, 15 oz cans',
    '1/2 cup', [110, 7, 20, 0, 7, 15, 370], { fib: 1, pot: 0.6, prot: 0.4, lowna: 0.9, cheap: 1, veg: 0.3 }, 1, 3, 'can'),
  I('olive-oil', 'Pantry', 'Olive oil', 'Wegmans Extra Virgin Olive Oil', 'Carlini Extra Virgin Olive Oil', 'Extra virgin olive oil',
    '1 tbsp', [120, 0, 0, 14, 0, 0, 0], { fat: 1, cal: 0.6, lowna: 1 }, 0.5, 1, 'bottle'),
  I('raisins', 'Pantry', 'Raisins', 'Wegmans Raisins', 'Southern Grove Raisins', 'Raisins',
    '1/4 cup', [120, 1, 32, 0, 1.5, 5, 300], { fruit: 0.6, cal: 0.6, pot: 0.6, carb: 0.6, lowna: 1 }, 0.3, 1, 'box'),
  // ---- Packaged goods that fit an athlete's week ----
  I('yogurt-cups', 'Dairy & Eggs', 'Greek yogurt cups', 'Oikos Pro or Oikos Triple Zero Greek yogurt cups, multi-pack', 'Friendly Farms Greek yogurt cups (pick the ones with 12 g+ protein)', 'Single-serve Greek yogurt cups, 15 g+ protein',
    '1 cup', [140, 20, 8, 2, 0, 85, 280], { prot: 0.9, dairy: 1, lean: 1, lowna: 1, quick: 1 }, 1, 1, 'pack', 'p'),
  I('string-cheese', 'Dairy & Eggs', 'String cheese', 'Wegmans Part-Skim Mozzarella String Cheese, 12 pack', 'Happy Farms Part-Skim Mozzarella String Cheese, 12 pack', 'Part-skim mozzarella string cheese, 12 pack',
    '1 stick', [80, 7, 1, 6, 0, 200, 25], { prot: 0.5, dairy: 0.8, lowna: 0.3, quick: 1 }, 0.4, 1, 'pack'),
  I('hummus', 'Dairy & Eggs', 'Hummus', 'Wegmans Classic Hummus', 'Park Street Deli Classic Hummus', 'Classic hummus, 10 oz tub',
    '1/4 cup', [140, 4, 9, 10, 3, 260, 110], { fib: 0.4, fat: 0.5, veg: 0.2, lowna: 0.3, quick: 0.8 }, 0.2, 1, 'tub'),
  I('edamame', 'Frozen', 'Frozen edamame', 'Wegmans Frozen Shelled Edamame', 'Aldi Frozen Shelled Edamame (frozen veggie section)', 'Frozen shelled edamame',
    '1 cup', [190, 18, 14, 8, 8, 10, 680], { prot: 0.6, fib: 0.8, veg: 0.6, pot: 0.7, lowna: 1, quick: 0.8 }, 0.6, 1, 'bag'),
  I('ready-rice', 'Bread & Grains', 'Ready-to-serve rice', 'Ready-to-serve rice cups or pouches (Uncle Ben\'s / Ben\'s Original or Wegmans), brown or jasmine', 'Earthly Grains Ready-to-Serve Rice pouches', 'Microwave rice cups or pouches (brown or jasmine)',
    '1 cup', [220, 5, 44, 3, 2, 10, 80], { carb: 1, cal: 0.5, lowna: 0.9, quick: 1 }, 0.6, 2, 'pack', 'cal'),
  I('protein-pasta', 'Bread & Grains', 'Protein pasta', 'Barilla Protein+ Penne or Banza Chickpea Pasta', 'Protein pasta (chickpea or lentil) - Aldi pasta aisle', 'Barilla Protein+ or chickpea pasta',
    '2 oz dry', [190, 10, 35, 1.5, 5, 0, 300], { carb: 1, prot: 0.4, fib: 0.5, cal: 0.4, lowna: 1, quick: 0.6 }, 0.6, 2, 'box'),
  I('bran-cereal', 'Bread & Grains', 'High-fiber cereal', 'Wegmans Bran Flakes or Raisin Bran (cereal aisle)', 'Millville Raisin Bran', 'Bran flakes or raisin bran cereal',
    '1 cup', [190, 5, 46, 1, 7, 210, 350], { fib: 1, carb: 0.8, pot: 0.4, lowna: 0.5, quick: 1 }, 0.4, 1, 'box'),
  I('tortillas', 'Bread & Grains', 'Whole wheat tortillas', 'Wegmans Whole Wheat Tortillas, burrito size', 'Pueblo Lindo Flour Tortillas (whole wheat if they have it)', 'Whole wheat tortillas, burrito size',
    '1 tortilla', [190, 6, 32, 5, 5, 420, 120], { carb: 0.8, cal: 0.5, fib: 0.4, lowna: -0.1, quick: 0.8 }, 0.4, 1, 'pack'),
  I('pancake-mix', 'Pantry', 'Protein pancake mix', 'Kodiak Power Cakes protein pancake mix (cereal / pancake aisle)', 'Protein pancake mix (Kodiak or Aldi store brand)', 'Kodiak Power Cakes protein pancake mix',
    '1/2 cup mix', [190, 14, 30, 2, 5, 390, 200], { carb: 0.8, prot: 0.5, cal: 0.5, fib: 0.4, lowna: 0.1, quick: 0.8 }, 0.5, 1, 'box'),
  I('canned-chicken', 'Pantry', 'Canned chicken', 'Canned Chunk Chicken Breast in Water, 12.5 oz (canned meat aisle)', 'Aldi Chunk Chicken Breast in Water, 12.5 oz can', 'Chunk chicken breast in water, 12.5 oz can',
    '2 oz', [60, 12, 0, 1, 0, 230, 120], { prot: 0.9, lean: 1, lowna: 0.1, quick: 1, cheap: 0.6 }, 0.5, 2, 'can', 'p'),
  I('protein-bars', 'Snacks', 'Protein bars', 'Protein bars, 20 g+ protein (Quest, Built or RXBAR - bar aisle)', 'Elevation Protein Bars', 'Protein bars, 20 g+ protein, under 10 g sugar',
    '1 bar', [200, 20, 22, 7, 7, 220, 180], { prot: 0.7, cal: 0.4, lowna: 0.6, quick: 1 }, 0.8, 1, 'box'),
  I('jerky', 'Snacks', 'Beef jerky', 'Beef jerky, original (Jack Link\'s or Wegmans) - snack aisle', 'Simms Original Beef Jerky', 'Beef jerky, original',
    '1 oz', [80, 11, 6, 1, 0, 500, 170], { prot: 0.8, lean: 0.8, lowna: -0.6, quick: 1 }, 0.3, 1, 'bag'),
  // ---- Supplements ----
  I('whey', 'Supplements', 'Whey protein powder', 'Whey protein powder, 2 lb tub (e.g. Optimum Nutrition Gold Standard) - Wegmans nutrition aisle', 'Whey protein powder - Aldi sometimes has a store brand (Elevation); if not, get it at Wegmans', 'Whey protein powder, 2 lb tub (Optimum Nutrition Gold Standard or similar)',
    '1 scoop', [120, 24, 3, 2, 0, 120, 170], { prot: 1, lean: 1, lowna: 0.8 }, 0, 1, 'tub'),
  I('rtd-shakes', 'Supplements', 'Protein shakes', 'Premier Protein or fairlife Core Power shakes, 4 pack', 'Ready-to-drink protein shakes, 30 g protein (Aldi shake section)', 'Ready-to-drink protein shakes, 30 g protein, 4 pack',
    '1 shake', [160, 30, 5, 3, 1, 370, 400], { prot: 0.9, lean: 0.8 }, 0, 1, 'pack'),
];
export const CAT_BY_ID = Object.fromEntries(CATALOG.map((x) => [x.id, x]));

// Trader Joe's (store #2): its own-label names where it has one; where it usually doesn't carry something, it says so.
// TJ's selection changes by store and season.
const TJ = {
  'chicken-breast': "Trader Joe's Boneless Skinless Chicken Breasts (fresh meat case)",
  'chicken-thighs': "Trader Joe's Boneless Skinless Chicken Thighs",
  'beef-93': "Trader Joe's Lean Ground Beef (pick 93/7 or leaner)",
  'turkey-93': "Trader Joe's Lean Ground Turkey, 93/7",
  salmon: "Trader Joe's Frozen Wild Alaskan Sockeye Salmon Fillets",
  shrimp: "Trader Joe's Frozen Raw Shrimp, peeled & deveined (or Argentinian Red Shrimp)",
  tuna: "Trader Joe's Skipjack (light) Tuna in Water, 5 oz cans",
  eggs: "Trader Joe's Large Cage Free Eggs, 1 dozen (grab 2)",
  'greek-yogurt': "Trader Joe's Nonfat Plain Greek Yogurt, 32 oz tub",
  'cottage-cheese': "Trader Joe's Lowfat Cottage Cheese, 16 oz",
  milk: "Trader Joe's Whole Milk, 1 gallon (or 2 half gallons)",
  'uf-milk': 'Ultra-filtered milk (fairlife) - usually not at Trader Joe\'s; grab it at Wegmans or use regular milk',
  'choc-milk': "Trader Joe's Lowfat Chocolate Milk, half gallon",
  bananas: 'Bananas (sold each at Trader Joe\'s - grab 6-7)',
  apples: 'Apples, bag (Honeycrisp or Gala)',
  clementines: 'Clementines, 3 lb bag',
  spinach: "Trader Joe's Organic Baby Spinach, bag",
  'sweet-potatoes': 'Sweet potatoes (loose or bag)',
  potatoes: "Trader Joe's Russet Potatoes, bag (or the Teeny Tiny Potatoes)",
  avocados: 'Avocados, bag of 4',
  carrots: "Trader Joe's Organic Baby Carrots, 1 lb bag",
  broccoli: "Trader Joe's Frozen Broccoli Florets",
  'mixed-veg': "Trader Joe's Frozen Organic Foursome or other plain mixed vegetables (no sauce)",
  berries: "Trader Joe's Frozen Fancy Berry Medley (or Organic Wild Blueberries)",
  oats: "Trader Joe's Rolled Oats",
  rice: "Trader Joe's Jasmine Rice, bag (or the Frozen Organic Jasmine Rice pouches)",
  'ww-bread': "Trader Joe's 100% Whole Wheat Bread (or Sprouted Wheat)",
  bagels: "Trader Joe's Plain Bagels, 6 pack",
  'ww-pasta': "Trader Joe's Organic Whole Wheat Spaghetti or Penne",
  'peanut-butter': "Trader Joe's Creamy Salted Peanut Butter (peanuts + salt)",
  'mixed-nuts': "Trader Joe's Unsalted Mixed Nuts (or Simply the Best Trek Mix)",
  'black-beans': "Trader Joe's Organic Black Beans, 15 oz cans (low sodium if there)",
  'olive-oil': "Trader Joe's Extra Virgin Olive Oil",
  raisins: "Trader Joe's Thompson Seedless Raisins",
  'yogurt-cups': "Trader Joe's Greek yogurt cups, single serve (pick the ones with 12 g+ protein)",
  'string-cheese': "Trader Joe's Light String Cheese, 12 pack",
  hummus: "Trader Joe's Mediterranean Hummus",
  edamame: "Trader Joe's Frozen Shelled Edamame",
  'ready-rice': "Trader Joe's Frozen Organic Jasmine or Brown Rice (3 microwave pouches)",
  'protein-pasta': "Trader Joe's Red Lentil Sedanini or chickpea pasta",
  'bran-cereal': "Trader Joe's high-fiber cereal (High Fiber O's or Bran Flakes)",
  tortillas: "Trader Joe's Whole Wheat Tortillas (or Carb Savvy)",
  'pancake-mix': "Trader Joe's Buttermilk Protein Pancake Mix",
  'canned-chicken': "Trader Joe's canned chicken breast, or Just Chicken (plain cooked strips, fridge case)",
  'protein-bars': 'Protein bars, 20 g+ protein - Trader Joe\'s bar shelf (or Wegmans)',
  jerky: "Trader Joe's Original Beef Jerky",
  whey: 'Whey protein powder - Trader Joe\'s has a vanilla or chocolate whey some weeks; if not, Wegmans nutrition aisle',
  'rtd-shakes': 'Ready-to-drink protein shakes, 30 g protein - not always at Trader Joe\'s; Wegmans or Aldi if not',
};

const JUNK_CATS = new Set(['Fast Food', 'Snacks']);
const PRODUCE_CATS = new Set(['Fruit', 'Veggies']);

// ---------- what the last 7 days looked like ----------
// The last 7 full days (through yesterday - today isn't over yet), same as the weekly report
export function weekReview(end = addDays(dayKey(), -1)) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const k = addDays(end, -i);
    const d = S.days[k];
    if (d && (d.food || []).length) days.push(k);
  }
  const n = days.length;
  const sum = { cal: 0, p: 0, c: 0, f: 0, fib: 0, na: 0, pot: 0 };
  const tgt = { cal: 0, p: 0, c: 0, f: 0, fib: 0, na: 0, pot: 0 };
  let junkCal = 0; let produce = 0; let unknown = 0; let items = 0;
  for (const k of days) {
    const t = totals(k);
    const tg = targets(k);
    for (const m of Object.keys(sum)) { sum[m] += t[m] || 0; tgt[m] += tg[m] || 0; }
    unknown += t.unknown;
    for (const e of S.days[k].food) {
      items++;
      const f = e.fid ? getFood(e.fid) : null;
      const cat = f ? f.cat : '';
      if (JUNK_CATS.has(cat) || String(e.fid || '').startsWith('ff:')) junkCal += e.cal * e.qty;
      if (PRODUCE_CATS.has(cat)) produce += e.qty;
    }
  }
  const avg = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, n ? v / n : 0]));
  return { days: n, pace: paceStatus(), avg: avg(sum), goal: avg(tgt), junkShare: sum.cal > 0 ? junkCal / sum.cal : 0, produce: n ? produce / n : 0, microGaps: items ? unknown / items : 0 };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const NEED_LABEL = {
  sodium: 'low-sodium whole foods', protein: 'lean protein', produce: 'more fruit & veggies', junk: 'real food to replace fast food & snacks',
  fiber: 'high-fiber foods', potassium: 'potassium-rich produce', calories: 'calorie-dense healthy foods', carbs: 'carbs for training',
  fat: 'leaner choices', cut: 'filling, lower-calorie foods',
};
// How far off each thing is, 0 (fine) to 1 (way off)
export function needsFrom(rv) {
  const N = { sodium: 0, protein: 0, produce: 0, junk: 0, fiber: 0, potassium: 0, calories: 0, carbs: 0, fat: 0, cut: 0 };
  if (rv.days < 3) return N;
  const a = rv.avg; const g = rv.goal;
  const cut = S.profile.goalWeight < S.profile.startWeight - 1;
  if (g.p) N.protein = clamp01((g.p - a.p) / g.p / 0.25);
  if (g.na) N.sodium = clamp01((a.na - g.na) / g.na / 0.5);
  if (g.fib) N.fiber = clamp01((g.fib - a.fib) / g.fib / 0.5);
  if (g.pot) N.potassium = clamp01((g.pot - a.pot) / g.pot / 0.5);
  N.produce = clamp01((4 - rv.produce) / 4);
  N.junk = clamp01((rv.junkShare - 0.15) / 0.3);
  if (g.cal) {
    // under the calorie goal only matters if the scale agrees (not gaining fast already)
    if (!cut && !(rv.pace && (rv.pace.status === 'fast' || rv.pace.status === 'ok'))) N.calories = clamp01((g.cal * 0.95 - a.cal) / g.cal / 0.2);
    else N.cut = clamp01((a.cal - g.cal * 1.05) / g.cal / 0.2);
  }
  if (g.c) N.carbs = clamp01((g.c * 0.9 - a.c) / g.c / 0.3);
  if (g.f) N.fat = clamp01((a.f - g.f * 1.1) / g.f / 0.3);
  return N;
}

function scoreItem(it, N) {
  const t = it.tags; const v = (k) => t[k] || 0;
  return it.base
    + N.protein * 3 * v('prot')
    + N.sodium * 3 * (v('lowna') - 0.5) * (v('lowna') < 0.5 ? 2 : 1)
    + N.produce * 2.5 * Math.max(v('fruit'), v('veg'))
    + N.junk * 2 * Math.max(v('whole') * 0.8, v('quick'))
    + N.fiber * 2.5 * v('fib')
    + N.potassium * 2 * v('pot')
    + N.calories * 2.5 * v('cal')
    + N.carbs * 2 * v('carb')
    + N.fat * 1.5 * v('lean')
    - N.cut * 1.5 * v('cal');
}

// Why this item is on the list - the one or two things it fixes this week
function whyFor(it, N) {
  const [cal, p, c, , fib, na, pot] = it.n;
  const t = it.tags; const v = (k) => t[k] || 0;
  const parts = [
    ['protein', N.protein * v('prot'), `${p}g protein per ${it.srv}`],
    ['sodium', N.sodium * Math.max(0, v('lowna')), `only ${na} mg sodium per ${it.srv}`],
    ['produce', N.produce * Math.max(v('fruit'), v('veg')), v('fruit') >= v('veg') ? 'a fruit serving' : 'a veggie serving'],
    ['potassium', N.potassium * v('pot'), `${pot} mg potassium (balances salt)`],
    ['fiber', N.fiber * v('fib'), `${fib}g fiber`],
    ['junk', N.junk * Math.max(v('whole') * 0.8, v('quick')), v('quick') >= 0.8 ? 'grab-and-go instead of fast food' : 'real food, quick to cook'],
    ['calories', N.calories * v('cal'), `${cal} kcal per ${it.srv} - easy calories`],
    ['carbs', N.carbs * v('carb'), `${c}g carbs per ${it.srv}`],
    ['fat', N.fat * v('lean'), 'lean - low fat'],
  ].filter(([, s]) => s > 0.15).sort((a, b) => b[1] - a[1]);
  // "real food" is the reason of last resort - a specific number says more
  const specific = parts.filter(([k, , txt]) => k !== 'junk' || /grab-and-go/.test(txt));
  const use = (specific.length ? specific : parts).slice(0, 2);
  if (use.length) return use.map((x) => x[2]).join(' · ');
  if (v('prot') >= 0.7) return `${p}g protein per ${it.srv}`;
  if (v('fruit') || v('veg')) return 'fruit & veggies every day';
  if (v('carb') >= 0.7) return `${c}g carbs per ${it.srv} - fuel for lifting`;
  if (v('fat') >= 0.8) return 'healthy fats';
  return '';
}

const STEP = { lb: 0.5 };
const PLURAL = { can: 'cans', carton: 'cartons', tub: 'tubs', gallon: 'gallons', bottle: 'bottles', 'half gallon': 'half gallons', bunch: 'bunches', bag: 'bags', canister: 'canisters', loaf: 'loaves', pack: 'packs', box: 'boxes', jar: 'jars' };
function qtyFor(it, N, tg) {
  let q = it.q;
  if (it.scale === 'p') q *= (tg.p || 200) / 200;
  if (it.scale === 'cal') q *= (tg.cal || 3000) / 3000;
  if ((it.tags.prot >= 0.7 && N.protein > 0.3) || ((it.tags.fruit || it.tags.veg) && N.produce > 0.3)) q *= 1.25;
  const st = STEP[it.unit] || 1;
  q = Math.max(st, Math.round(q / st) * st);
  return `${q} ${q > 1 && PLURAL[it.unit] ? PLURAL[it.unit] : it.unit}`;
}

// Groups the list has to cover, with min / max picks
const GROUPS = [
  ['protein', (t) => (t.prot || 0) >= 0.7, 3, 6],
  ['fruit', (t) => (t.fruit || 0) >= 0.6, 2, 3],
  ['veg', (t) => (t.veg || 0) >= 0.5, 2, 4],
  ['carb', (t) => (t.carb || 0) >= 0.7, 2, 4],
  ['dairy', (t) => (t.dairy || 0) >= 0.8, 1, 3],
  ['fat', (t) => (t.fat || 0) >= 0.8, 1, 2],
  ['quick', (t) => (t.quick || 0) >= 0.8, 1, 4],   // at least one packaged grab-and-go item
];
const groupOf = (it) => {
  for (const [g, test] of GROUPS) if (test(it.tags)) return g;
  return 'other';
};

export function buildList(size = 20) {
  const rv = weekReview();
  const N = needsFrom(rv);
  const tg = targets(dayKey());
  const scored = CATALOG.map((it) => ({ it, s: scoreItem(it, N) })).sort((a, b) => b.s - a.s);
  const picked = [];
  const has = (id) => picked.some((x) => x.it.id === id);
  // protein powder when protein is short, or the target is high enough that food alone is a grind
  if (N.protein > 0.15 || (tg.p || 0) >= 180) picked.push(scored.find((x) => x.it.id === 'whey'));
  for (const [, test, min] of GROUPS) {
    let n = picked.filter((x) => test(x.it.tags)).length;
    for (const x of scored) { if (n >= min) break; if (!has(x.it.id) && test(x.it.tags)) { picked.push(x); n++; } }
  }
  for (const x of scored) {
    if (picked.length >= size) break;
    if (has(x.it.id) || x.s <= 0.2) continue;
    const g = groupOf(x.it);
    const grp = GROUPS.find(([k]) => k === g);
    if (grp && picked.filter((y) => groupOf(y.it) === g).length >= grp[3]) continue;
    picked.push(x);
  }
  const items = picked.filter(Boolean).map(({ it }) => ({ id: it.id, qty: qtyFor(it, N, tg), why: whyFor(it, N) }));
  items.sort((a, b) => SECTIONS.indexOf(CAT_BY_ID[a.id].sec) - SECTIONS.indexOf(CAT_BY_ID[b.id].sec));
  const top = Object.entries(N).filter(([, v]) => v > 0.25).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  return { built: dayKey(), items, focus: top, got: {} };
}

// The description to look for at the chosen store (Wegmans first, then Aldi, then any store)
export function descFor(it, store) {
  let d = store === 'tj' ? TJ[it.id] || it.any : store === 'aldi' ? it.a || it.any : store === 'any' ? it.any : it.w || it.a || it.any;
  // cutting: 2% milk instead of whole
  if (it.id === 'milk' && S.profile.goalWeight < S.profile.startWeight - 1) d = d.replace(/Whole Milk/i, '2% Reduced Fat Milk');
  return d;
}


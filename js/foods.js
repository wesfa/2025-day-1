// Built-in food database. Values are per listed serving and are approximate
// (USDA / restaurant published numbers). Anything missing can be found with
// the online search (Open Food Facts) or added as a custom food.
// Format: [name, serving, calories, protein g, carbs g, fat g, fiber g, sodium mg, potassium mg, category]

const RAW = [
  // ---- Protein ----
  ['Chicken breast, grilled', '4 oz cooked', 187, 35, 0, 4, 0, 85, 290, 'Protein'],
  ['Chicken breast, grilled', '6 oz cooked', 280, 53, 0, 6, 0, 125, 435, 'Protein'],
  ['Chicken thigh, skinless', '4 oz cooked', 205, 28, 0, 9, 0, 95, 270, 'Protein'],
  ['Rotisserie chicken, meat only', '4 oz', 190, 29, 0, 8, 0, 550, 280, 'Protein'],
  ['Ground beef 80/20, cooked', '4 oz', 307, 31, 0, 20, 0, 85, 360, 'Protein'],
  ['Ground beef 93/7, cooked', '4 oz', 210, 29, 0, 10, 0, 85, 420, 'Protein'],
  ['Ground turkey 93/7, cooked', '4 oz', 200, 25, 0, 11, 0, 100, 330, 'Protein'],
  ['Steak, sirloin', '6 oz cooked', 350, 51, 0, 15, 0, 95, 560, 'Protein'],
  ['Pork chop, lean', '5 oz cooked', 280, 41, 0, 11, 0, 90, 525, 'Protein'],
  ['Salmon', '4 oz cooked', 233, 25, 0, 14, 0, 70, 435, 'Protein'],
  ['Tuna, canned in water', '1 can drained', 120, 26, 0, 1, 0, 350, 330, 'Protein'],
  ['Shrimp', '4 oz cooked', 112, 27, 0, 1, 0, 300, 190, 'Protein'],
  ['Egg, large', '1 egg', 72, 6, 0, 5, 0, 70, 70, 'Protein'],
  ['Scrambled eggs (3) w/ butter', '3 eggs', 250, 19, 1, 19, 0, 260, 210, 'Protein'],
  ['Egg whites, liquid', '1/2 cup', 63, 13, 1, 0, 0, 200, 190, 'Protein'],
  ['Bacon', '3 slices', 130, 9, 0, 10, 0, 580, 170, 'Protein'],
  ['Breakfast sausage links', '2 links', 160, 8, 1, 14, 0, 400, 110, 'Protein'],
  ['Turkey, deli sliced', '2 oz', 60, 10, 2, 1, 0, 500, 180, 'Protein'],
  ['Ham, deli sliced', '2 oz', 60, 9, 2, 2, 0, 600, 170, 'Protein'],
  ['Beef jerky', '1 oz', 80, 11, 6, 1, 0.5, 500, 170, 'Protein'],
  ['Meat stick', '1 stick', 90, 10, 0, 5, 0, 350, 120, 'Protein'],
  ['Hot dog (frank only)', '1 frank', 150, 5, 2, 13, 0, 500, 90, 'Protein'],
  ['Tofu, firm', '1/2 cup', 181, 22, 4, 11, 3, 15, 300, 'Protein'],
  ['Black beans', '1/2 cup', 114, 8, 20, 0, 7.5, 200, 305, 'Protein'],
  ['Refried beans', '1/2 cup', 120, 6, 18, 2, 6, 520, 420, 'Protein'],

  // ---- Shakes & bars ----
  ['Whey protein powder', '1 scoop', 120, 24, 3, 2, 0, 120, 170, 'Shakes & Bars'],
  ['Protein shake, ready-to-drink', '11 oz bottle', 160, 30, 5, 3, 1, 370, 400, 'Shakes & Bars'],
  ['Protein shake, 42g ready-to-drink', '14 oz bottle', 230, 42, 8, 4, 1, 320, 600, 'Shakes & Bars'],
  ['Mass gainer (check your label)', '2 scoops', 650, 32, 120, 5, 3, 340, 900, 'Shakes & Bars'],
  ['Protein bar, typical', '1 bar', 200, 20, 22, 7, 7, 220, 180, 'Shakes & Bars'],
  ['Clif bar', '1 bar', 250, 10, 44, 5, 4, 150, 230, 'Shakes & Bars'],
  ['Granola bar', '2 bars', 190, 4, 29, 7, 2, 170, 120, 'Shakes & Bars'],

  // ---- Dairy ----
  ['Milk, whole', '1 cup', 150, 8, 12, 8, 0, 105, 320, 'Dairy'],
  ['Milk, 2%', '1 cup', 122, 8, 12, 5, 0, 115, 340, 'Dairy'],
  ['Milk, skim', '1 cup', 83, 8, 12, 0, 0, 105, 380, 'Dairy'],
  ['Ultra-filtered milk, 2%', '1 cup', 120, 13, 6, 5, 0, 120, 400, 'Dairy'],
  ['Chocolate milk, lowfat', '1 cup', 160, 8, 26, 3, 1, 160, 425, 'Dairy'],
  ['Greek yogurt, plain nonfat', '6 oz', 100, 17, 6, 0, 0, 60, 240, 'Dairy'],
  ['Greek yogurt, flavored', '5.3 oz cup', 130, 11, 17, 2, 0, 55, 200, 'Dairy'],
  ['Cottage cheese, 2%', '1/2 cup', 90, 12, 5, 3, 0, 350, 140, 'Dairy'],
  ['Cheddar cheese', '1 oz', 115, 7, 0, 9, 0, 180, 20, 'Dairy'],
  ['American cheese', '1 slice', 60, 3, 2, 4, 0, 260, 50, 'Dairy'],
  ['String cheese', '1 stick', 80, 7, 1, 6, 0, 200, 25, 'Dairy'],
  ['Butter', '1 tbsp', 100, 0, 0, 12, 0, 90, 0, 'Dairy'],
  ['Ice cream, vanilla', '1/2 cup', 140, 2, 16, 7, 0, 55, 130, 'Dairy'],

  // ---- Carbs & grains ----
  ['White rice', '1 cup cooked', 205, 4, 45, 0, 0.6, 0, 55, 'Carbs'],
  ['Brown rice', '1 cup cooked', 216, 5, 45, 2, 3.5, 10, 155, 'Carbs'],
  ['Pasta', '1 cup cooked', 220, 8, 43, 1, 2.5, 0, 60, 'Carbs'],
  ['Oats, rolled (dry)', '1/2 cup', 150, 5, 27, 3, 4, 0, 140, 'Carbs'],
  ['Instant oatmeal, flavored', '1 packet', 160, 4, 32, 2, 3, 260, 110, 'Carbs'],
  ['Bread, white', '1 slice', 75, 2, 14, 1, 0.8, 140, 35, 'Carbs'],
  ['Bread, whole wheat', '1 slice', 81, 4, 14, 1, 2, 145, 80, 'Carbs'],
  ['Bagel, plain', '1 medium', 280, 11, 55, 2, 2.5, 470, 105, 'Carbs'],
  ['English muffin', '1 muffin', 135, 5, 26, 1, 2, 250, 90, 'Carbs'],
  ['Hamburger bun', '1 bun', 140, 5, 26, 2, 1, 210, 60, 'Carbs'],
  ['Flour tortilla, 10"', '1 tortilla', 210, 6, 35, 5, 2, 450, 90, 'Carbs'],
  ['Corn tortilla', '1 tortilla', 50, 1, 11, 1, 1.5, 10, 50, 'Carbs'],
  ['Potato, baked', '1 medium', 160, 4, 37, 0, 3.8, 15, 925, 'Carbs'],
  ['Sweet potato, baked', '1 medium', 105, 2, 24, 0, 3.8, 40, 540, 'Carbs'],
  ['Cereal, typical (check label)', '1 cup', 140, 3, 30, 2, 2, 200, 100, 'Carbs'],
  ['Granola', '1/2 cup', 280, 6, 34, 14, 4, 80, 250, 'Carbs'],
  ['Pancakes (no syrup)', '2 x 6"', 350, 10, 44, 14, 1.5, 690, 200, 'Carbs'],
  ['Waffles, frozen', '2 waffles', 180, 4, 27, 6, 1, 400, 80, 'Carbs'],
  ['Pancake syrup', '1/4 cup', 210, 0, 53, 0, 0, 50, 10, 'Carbs'],
  ['Ramen, instant', '1 package', 380, 10, 52, 14, 2, 1750, 130, 'Carbs'],
  ['Mac & cheese, boxed', '1 cup prepared', 350, 10, 48, 13, 1.5, 720, 190, 'Carbs'],
  ['Pretzels', '1 oz', 110, 3, 23, 1, 1, 380, 40, 'Carbs'],
  ['Honey', '1 tbsp', 64, 0, 17, 0, 0, 0, 10, 'Carbs'],
  ['Jelly / jam', '1 tbsp', 50, 0, 13, 0, 0, 5, 15, 'Carbs'],

  // ---- Fruit ----
  ['Banana', '1 medium', 105, 1, 27, 0, 3.1, 1, 420, 'Fruit'],
  ['Apple', '1 medium', 95, 0, 25, 0, 4.4, 2, 195, 'Fruit'],
  ['Orange', '1 medium', 60, 1, 15, 0, 3.1, 0, 235, 'Fruit'],
  ['Grapes', '1 cup', 104, 1, 27, 0, 1.4, 3, 290, 'Fruit'],
  ['Strawberries', '1 cup', 50, 1, 12, 0, 3, 2, 235, 'Fruit'],
  ['Blueberries', '1 cup', 85, 1, 21, 0, 3.6, 1, 115, 'Fruit'],
  ['Pineapple', '1 cup', 82, 1, 22, 0, 2.3, 2, 180, 'Fruit'],
  ['Mango', '1 cup', 99, 1, 25, 1, 2.6, 2, 280, 'Fruit'],
  ['Watermelon', '2 cups diced', 92, 2, 23, 0, 1.2, 3, 340, 'Fruit'],
  ['Raisins', '1 small box', 130, 1, 34, 0, 1.6, 5, 320, 'Fruit'],
  ['Applesauce, unsweetened', '1 cup (4 oz)', 50, 0, 13, 0, 1.2, 2, 85, 'Fruit'],
  ['Orange juice', '1 cup', 110, 2, 26, 0, 0.5, 2, 495, 'Fruit'],
  ['Apple juice', '1 cup', 114, 0, 28, 0, 0.5, 10, 250, 'Fruit'],

  // ---- Veggies ----
  ['Broccoli', '1 cup cooked', 55, 4, 11, 1, 5.1, 65, 455, 'Veggies'],
  ['Green beans', '1 cup cooked', 44, 2, 10, 0, 4, 5, 180, 'Veggies'],
  ['Corn', '1 cup', 130, 5, 29, 2, 4, 5, 360, 'Veggies'],
  ['Mixed vegetables, frozen', '1 cup cooked', 110, 5, 22, 0, 8, 65, 310, 'Veggies'],
  ['Baby carrots', '1 cup', 45, 1, 10, 0, 3.8, 100, 300, 'Veggies'],
  ['Spinach, raw', '2 cups', 14, 2, 2, 0, 1.3, 47, 335, 'Veggies'],
  ['Salad greens', '2 cups', 15, 1, 3, 0, 1.5, 10, 170, 'Veggies'],
  ['Avocado', '1/2 avocado', 120, 2, 6, 11, 6.7, 7, 485, 'Veggies'],

  // ---- Fats, nuts, sauces ----
  ['Peanut butter', '2 tbsp', 190, 7, 7, 16, 2, 140, 190, 'Fats & Sauces'],
  ['Almonds', '1 oz (~23)', 165, 6, 6, 14, 3.5, 0, 210, 'Fats & Sauces'],
  ['Mixed nuts', '1 oz', 170, 5, 6, 15, 2.5, 110, 180, 'Fats & Sauces'],
  ['Trail mix', '1/4 cup', 175, 5, 16, 11, 2, 85, 250, 'Fats & Sauces'],
  ['Olive oil', '1 tbsp', 120, 0, 0, 14, 0, 0, 0, 'Fats & Sauces'],
  ['Mayo', '1 tbsp', 95, 0, 0, 10, 0, 90, 0, 'Fats & Sauces'],
  ['Ranch dressing', '2 tbsp', 130, 0, 2, 13, 0, 260, 20, 'Fats & Sauces'],
  ['Hummus', '2 tbsp', 70, 2, 4, 5, 2, 130, 70, 'Fats & Sauces'],
  ['Ketchup', '1 tbsp', 20, 0, 5, 0, 0, 160, 50, 'Fats & Sauces'],
  ['BBQ sauce', '2 tbsp', 60, 0, 15, 0, 0, 330, 80, 'Fats & Sauces'],

  // ---- Meals ----
  ['PB&J sandwich', '1 sandwich', 390, 11, 48, 18, 4, 430, 280, 'Meals'],
  ['PB&J, frozen crustless', '1 sandwich', 210, 6, 26, 9, 2, 220, 110, 'Meals'],
  ['Turkey & cheese sandwich', '1 sandwich', 405, 23, 32, 19, 2, 1350, 380, 'Meals'],
  ['Grilled cheese', '1 sandwich', 370, 10, 32, 22, 1.5, 880, 170, 'Meals'],
  ['Cheeseburger, homemade 1/4 lb', '1 burger', 450, 28, 27, 24, 1, 600, 400, 'Meals'],
  ['Chicken & rice bowl', '6 oz chicken + 1.5 cup rice', 590, 56, 68, 7, 1, 400, 520, 'Meals'],
  ['Spaghetti w/ meat sauce', '2 cups', 600, 30, 78, 17, 6, 1000, 800, 'Meals'],
  ['Pizza, cheese', '1 large slice', 285, 12, 36, 10, 2.5, 640, 180, 'Meals'],
  ['Pizza, pepperoni', '1 large slice', 310, 13, 35, 13, 2.5, 760, 200, 'Meals'],

  // ---- Fast food (approx.) ----
  ['Chick-fil-A Chicken Sandwich', '1 sandwich', 420, 29, 41, 18, 1, 1400, 400, 'Fast Food'],
  ['Chick-fil-A Grilled Chicken Sandwich', '1 sandwich', 390, 28, 44, 12, 4, 820, 500, 'Fast Food'],
  ['Chick-fil-A Nuggets', '8 count', 250, 27, 11, 11, 0, 1050, 300, 'Fast Food'],
  ['Chick-fil-A Grilled Nuggets', '12 count', 200, 38, 2, 4.5, 0, 660, 500, 'Fast Food'],
  ['Chick-fil-A Waffle Fries', 'medium', 420, 5, 45, 24, 5, 240, 650, 'Fast Food'],
  ["McDonald's Big Mac", '1 burger', 590, 25, 46, 34, 3, 1050, 400, 'Fast Food'],
  ["McDonald's Quarter Pounder w/ Cheese", '1 burger', 520, 30, 42, 26, 2, 1100, 480, 'Fast Food'],
  ["McDonald's McChicken", '1 sandwich', 400, 14, 39, 21, 2, 560, 250, 'Fast Food'],
  ["McDonald's McNuggets", '10 piece', 410, 23, 26, 24, 0, 840, 380, 'Fast Food'],
  ["McDonald's Egg McMuffin", '1 sandwich', 310, 17, 30, 13, 2, 770, 230, 'Fast Food'],
  ["McDonald's Sausage McMuffin w/ Egg", '1 sandwich', 480, 21, 30, 31, 2, 830, 280, 'Fast Food'],
  ['French fries, fast food', 'medium', 320, 5, 43, 15, 4, 260, 600, 'Fast Food'],
  ['Burger King Whopper', '1 burger', 670, 31, 51, 40, 2, 980, 500, 'Fast Food'],
  ["Wendy's Dave's Single", '1 burger', 590, 29, 39, 37, 2, 1250, 500, 'Fast Food'],
  ['Chipotle chicken bowl (rice, beans, cheese, salsa)', '1 bowl', 680, 50, 73, 21, 11, 1750, 1100, 'Fast Food'],
  ['Chipotle chicken burrito (rice, beans, cheese, salsa)', '1 burrito', 1000, 58, 123, 30, 14, 2350, 1200, 'Fast Food'],
  ['Subway 6" turkey sub', '1 sub', 280, 18, 46, 4, 3, 800, 400, 'Fast Food'],
  ['Taco Bell Crunchy Taco', '1 taco', 170, 8, 13, 9, 3, 310, 170, 'Fast Food'],
  ['Taco Bell Chicken Quesadilla', '1 quesadilla', 510, 27, 37, 26, 3, 1250, 350, 'Fast Food'],
  ['Panda Express Orange Chicken', '1 entree', 490, 25, 51, 23, 1, 820, 200, 'Fast Food'],
  ['Panda Express Fried Rice', '1 side', 520, 11, 85, 16, 1, 850, 160, 'Fast Food'],
  ['Panda Express Chow Mein', '1 side', 510, 13, 80, 20, 6, 980, 200, 'Fast Food'],

  // ---- Snacks & sweets ----
  ['Potato chips', '1 oz', 150, 2, 15, 10, 1, 170, 350, 'Snacks'],
  ['Tortilla chips, nacho', '1 oz', 150, 2, 18, 8, 1, 210, 50, 'Snacks'],
  ['Cheese crackers (goldfish)', '55 pieces', 140, 4, 20, 5, 1, 250, 30, 'Snacks'],
  ['Sandwich cookies', '3 cookies', 160, 1, 25, 7, 1, 135, 60, 'Snacks'],
  ['Chocolate bar', '1.55 oz bar', 210, 3, 26, 13, 1, 35, 170, 'Snacks'],
  ['Toaster pastries', '2 pastries', 370, 4, 70, 9, 1, 340, 80, 'Snacks'],
  ['Rice crispy treat', '1 bar', 90, 1, 17, 2, 0, 100, 10, 'Snacks'],

  // ---- Drinks ----
  ['Sports drink', '20 oz', 140, 0, 36, 0, 0, 270, 75, 'Drinks'],
  ['Sports drink, zero sugar', '20 oz', 5, 0, 1, 0, 0, 270, 75, 'Drinks'],
  ['Soda, cola', '12 oz can', 140, 0, 39, 0, 0, 45, 0, 'Drinks'],
  ['Sweet tea', '16 oz', 180, 0, 45, 0, 0, 10, 60, 'Drinks'],
  ['Energy drink, regular', '16 oz', 220, 0, 56, 0, 0, 370, 0, 'Drinks'],
  ['Coffee, black', '1 cup', 2, 0, 0, 0, 0, 5, 115, 'Drinks'],
];

export const FOOD_CATEGORIES = [
  'Protein', 'Shakes & Bars', 'Dairy', 'Carbs', 'Fruit', 'Veggies',
  'Fats & Sauces', 'Meals', 'Fast Food', 'Snacks', 'Drinks',
];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const FOODS = RAW.map(([name, serving, cal, p, c, f, fib, na, pot, cat]) => ({
  id: 'b:' + slug(name + '-' + serving),
  name, serving, cal, p, c, f, fib, na, pot, cat,
}));

// Fast lookup helpers
export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

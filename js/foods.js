// Built-in food database. Values are per listed serving and are approximate
// (USDA / restaurant published numbers). Anything missing can be found with
// the online search (Open Food Facts) or added as a custom food.
// Format: [name, serving, calories, protein g, carbs g, fat g, category]

const RAW = [
  // ---- Protein ----
  ['Chicken breast, grilled', '4 oz cooked', 187, 35, 0, 4, 'Protein'],
  ['Chicken breast, grilled', '6 oz cooked', 280, 53, 0, 6, 'Protein'],
  ['Chicken thigh, skinless', '4 oz cooked', 205, 28, 0, 9, 'Protein'],
  ['Rotisserie chicken, meat only', '4 oz', 190, 29, 0, 8, 'Protein'],
  ['Ground beef 80/20, cooked', '4 oz', 307, 31, 0, 20, 'Protein'],
  ['Ground beef 93/7, cooked', '4 oz', 210, 29, 0, 10, 'Protein'],
  ['Ground turkey 93/7, cooked', '4 oz', 200, 25, 0, 11, 'Protein'],
  ['Steak, sirloin', '6 oz cooked', 350, 51, 0, 15, 'Protein'],
  ['Pork chop, lean', '5 oz cooked', 280, 41, 0, 11, 'Protein'],
  ['Salmon', '4 oz cooked', 233, 25, 0, 14, 'Protein'],
  ['Tuna, canned in water', '1 can drained', 120, 26, 0, 1, 'Protein'],
  ['Shrimp', '4 oz cooked', 112, 27, 0, 1, 'Protein'],
  ['Egg, large', '1 egg', 72, 6, 0, 5, 'Protein'],
  ['Scrambled eggs (3) w/ butter', '3 eggs', 250, 19, 1, 19, 'Protein'],
  ['Egg whites, liquid', '1/2 cup', 63, 13, 1, 0, 'Protein'],
  ['Bacon', '3 slices', 130, 9, 0, 10, 'Protein'],
  ['Breakfast sausage links', '2 links', 160, 8, 1, 14, 'Protein'],
  ['Turkey, deli sliced', '2 oz', 60, 10, 2, 1, 'Protein'],
  ['Ham, deli sliced', '2 oz', 60, 9, 2, 2, 'Protein'],
  ['Beef jerky', '1 oz', 80, 11, 6, 1, 'Protein'],
  ['Meat stick', '1 stick', 90, 10, 0, 5, 'Protein'],
  ['Hot dog (frank only)', '1 frank', 150, 5, 2, 13, 'Protein'],
  ['Tofu, firm', '1/2 cup', 181, 22, 4, 11, 'Protein'],
  ['Black beans', '1/2 cup', 114, 8, 20, 0, 'Protein'],
  ['Refried beans', '1/2 cup', 120, 6, 18, 2, 'Protein'],

  // ---- Shakes & bars ----
  ['Whey protein powder', '1 scoop', 120, 24, 3, 2, 'Shakes & Bars'],
  ['Protein shake, ready-to-drink', '11 oz bottle', 160, 30, 5, 3, 'Shakes & Bars'],
  ['Protein shake, 42g ready-to-drink', '14 oz bottle', 230, 42, 8, 4, 'Shakes & Bars'],
  ['Mass gainer (check your label)', '2 scoops', 650, 32, 120, 5, 'Shakes & Bars'],
  ['Protein bar, typical', '1 bar', 200, 20, 22, 7, 'Shakes & Bars'],
  ['Clif bar', '1 bar', 250, 10, 44, 5, 'Shakes & Bars'],
  ['Granola bar', '2 bars', 190, 4, 29, 7, 'Shakes & Bars'],

  // ---- Dairy ----
  ['Milk, whole', '1 cup', 150, 8, 12, 8, 'Dairy'],
  ['Milk, 2%', '1 cup', 122, 8, 12, 5, 'Dairy'],
  ['Milk, skim', '1 cup', 83, 8, 12, 0, 'Dairy'],
  ['Ultra-filtered milk, 2%', '1 cup', 120, 13, 6, 5, 'Dairy'],
  ['Chocolate milk, lowfat', '1 cup', 160, 8, 26, 3, 'Dairy'],
  ['Greek yogurt, plain nonfat', '6 oz', 100, 17, 6, 0, 'Dairy'],
  ['Greek yogurt, flavored', '5.3 oz cup', 130, 11, 17, 2, 'Dairy'],
  ['Cottage cheese, 2%', '1/2 cup', 90, 12, 5, 3, 'Dairy'],
  ['Cheddar cheese', '1 oz', 115, 7, 0, 9, 'Dairy'],
  ['American cheese', '1 slice', 60, 3, 2, 4, 'Dairy'],
  ['String cheese', '1 stick', 80, 7, 1, 6, 'Dairy'],
  ['Butter', '1 tbsp', 100, 0, 0, 12, 'Dairy'],
  ['Ice cream, vanilla', '1/2 cup', 140, 2, 16, 7, 'Dairy'],

  // ---- Carbs & grains ----
  ['White rice', '1 cup cooked', 205, 4, 45, 0, 'Carbs'],
  ['Brown rice', '1 cup cooked', 216, 5, 45, 2, 'Carbs'],
  ['Pasta', '1 cup cooked', 220, 8, 43, 1, 'Carbs'],
  ['Oats, rolled (dry)', '1/2 cup', 150, 5, 27, 3, 'Carbs'],
  ['Instant oatmeal, flavored', '1 packet', 160, 4, 32, 2, 'Carbs'],
  ['Bread, white', '1 slice', 75, 2, 14, 1, 'Carbs'],
  ['Bread, whole wheat', '1 slice', 81, 4, 14, 1, 'Carbs'],
  ['Bagel, plain', '1 medium', 280, 11, 55, 2, 'Carbs'],
  ['English muffin', '1 muffin', 135, 5, 26, 1, 'Carbs'],
  ['Hamburger bun', '1 bun', 140, 5, 26, 2, 'Carbs'],
  ['Flour tortilla, 10"', '1 tortilla', 210, 6, 35, 5, 'Carbs'],
  ['Corn tortilla', '1 tortilla', 50, 1, 11, 1, 'Carbs'],
  ['Potato, baked', '1 medium', 160, 4, 37, 0, 'Carbs'],
  ['Sweet potato, baked', '1 medium', 105, 2, 24, 0, 'Carbs'],
  ['Cereal, typical (check label)', '1 cup', 140, 3, 30, 2, 'Carbs'],
  ['Granola', '1/2 cup', 280, 6, 34, 14, 'Carbs'],
  ['Pancakes (no syrup)', '2 x 6"', 350, 10, 44, 14, 'Carbs'],
  ['Waffles, frozen', '2 waffles', 180, 4, 27, 6, 'Carbs'],
  ['Pancake syrup', '1/4 cup', 210, 0, 53, 0, 'Carbs'],
  ['Ramen, instant', '1 package', 380, 10, 52, 14, 'Carbs'],
  ['Mac & cheese, boxed', '1 cup prepared', 350, 10, 48, 13, 'Carbs'],
  ['Pretzels', '1 oz', 110, 3, 23, 1, 'Carbs'],
  ['Honey', '1 tbsp', 64, 0, 17, 0, 'Carbs'],
  ['Jelly / jam', '1 tbsp', 50, 0, 13, 0, 'Carbs'],

  // ---- Fruit ----
  ['Banana', '1 medium', 105, 1, 27, 0, 'Fruit'],
  ['Apple', '1 medium', 95, 0, 25, 0, 'Fruit'],
  ['Orange', '1 medium', 60, 1, 15, 0, 'Fruit'],
  ['Grapes', '1 cup', 104, 1, 27, 0, 'Fruit'],
  ['Strawberries', '1 cup', 50, 1, 12, 0, 'Fruit'],
  ['Blueberries', '1 cup', 85, 1, 21, 0, 'Fruit'],
  ['Pineapple', '1 cup', 82, 1, 22, 0, 'Fruit'],
  ['Mango', '1 cup', 99, 1, 25, 1, 'Fruit'],
  ['Watermelon', '2 cups diced', 92, 2, 23, 0, 'Fruit'],
  ['Raisins', '1 small box', 130, 1, 34, 0, 'Fruit'],
  ['Applesauce, unsweetened', '1 cup (4 oz)', 50, 0, 13, 0, 'Fruit'],
  ['Orange juice', '1 cup', 110, 2, 26, 0, 'Fruit'],
  ['Apple juice', '1 cup', 114, 0, 28, 0, 'Fruit'],

  // ---- Veggies ----
  ['Broccoli', '1 cup cooked', 55, 4, 11, 1, 'Veggies'],
  ['Green beans', '1 cup cooked', 44, 2, 10, 0, 'Veggies'],
  ['Corn', '1 cup', 130, 5, 29, 2, 'Veggies'],
  ['Mixed vegetables, frozen', '1 cup cooked', 110, 5, 22, 0, 'Veggies'],
  ['Baby carrots', '1 cup', 45, 1, 10, 0, 'Veggies'],
  ['Spinach, raw', '2 cups', 14, 2, 2, 0, 'Veggies'],
  ['Salad greens', '2 cups', 15, 1, 3, 0, 'Veggies'],
  ['Avocado', '1/2 avocado', 120, 2, 6, 11, 'Veggies'],

  // ---- Fats, nuts, sauces ----
  ['Peanut butter', '2 tbsp', 190, 7, 7, 16, 'Fats & Sauces'],
  ['Almonds', '1 oz (~23)', 165, 6, 6, 14, 'Fats & Sauces'],
  ['Mixed nuts', '1 oz', 170, 5, 6, 15, 'Fats & Sauces'],
  ['Trail mix', '1/4 cup', 175, 5, 16, 11, 'Fats & Sauces'],
  ['Olive oil', '1 tbsp', 120, 0, 0, 14, 'Fats & Sauces'],
  ['Mayo', '1 tbsp', 95, 0, 0, 10, 'Fats & Sauces'],
  ['Ranch dressing', '2 tbsp', 130, 0, 2, 13, 'Fats & Sauces'],
  ['Hummus', '2 tbsp', 70, 2, 4, 5, 'Fats & Sauces'],
  ['Ketchup', '1 tbsp', 20, 0, 5, 0, 'Fats & Sauces'],
  ['BBQ sauce', '2 tbsp', 60, 0, 15, 0, 'Fats & Sauces'],

  // ---- Meals ----
  ['PB&J sandwich', '1 sandwich', 390, 11, 48, 18, 'Meals'],
  ['PB&J, frozen crustless', '1 sandwich', 210, 6, 26, 9, 'Meals'],
  ['Turkey & cheese sandwich', '1 sandwich', 405, 23, 32, 19, 'Meals'],
  ['Grilled cheese', '1 sandwich', 370, 10, 32, 22, 'Meals'],
  ['Cheeseburger, homemade 1/4 lb', '1 burger', 450, 28, 27, 24, 'Meals'],
  ['Chicken & rice bowl', '6 oz chicken + 1.5 cup rice', 590, 56, 68, 7, 'Meals'],
  ['Spaghetti w/ meat sauce', '2 cups', 600, 30, 78, 17, 'Meals'],
  ['Pizza, cheese', '1 large slice', 285, 12, 36, 10, 'Meals'],
  ['Pizza, pepperoni', '1 large slice', 310, 13, 35, 13, 'Meals'],

  // ---- Fast food (approx.) ----
  ['Chick-fil-A Chicken Sandwich', '1 sandwich', 420, 29, 41, 18, 'Fast Food'],
  ['Chick-fil-A Grilled Chicken Sandwich', '1 sandwich', 390, 28, 44, 12, 'Fast Food'],
  ['Chick-fil-A Nuggets', '8 count', 250, 27, 11, 11, 'Fast Food'],
  ['Chick-fil-A Grilled Nuggets', '12 count', 200, 38, 2, 4.5, 'Fast Food'],
  ['Chick-fil-A Waffle Fries', 'medium', 420, 5, 45, 24, 'Fast Food'],
  ["McDonald's Big Mac", '1 burger', 590, 25, 46, 34, 'Fast Food'],
  ["McDonald's Quarter Pounder w/ Cheese", '1 burger', 520, 30, 42, 26, 'Fast Food'],
  ["McDonald's McChicken", '1 sandwich', 400, 14, 39, 21, 'Fast Food'],
  ["McDonald's McNuggets", '10 piece', 410, 23, 26, 24, 'Fast Food'],
  ["McDonald's Egg McMuffin", '1 sandwich', 310, 17, 30, 13, 'Fast Food'],
  ["McDonald's Sausage McMuffin w/ Egg", '1 sandwich', 480, 21, 30, 31, 'Fast Food'],
  ['French fries, fast food', 'medium', 320, 5, 43, 15, 'Fast Food'],
  ['Burger King Whopper', '1 burger', 670, 31, 51, 40, 'Fast Food'],
  ["Wendy's Dave's Single", '1 burger', 590, 29, 39, 37, 'Fast Food'],
  ['Chipotle chicken bowl (rice, beans, cheese, salsa)', '1 bowl', 680, 50, 73, 21, 'Fast Food'],
  ['Chipotle chicken burrito (rice, beans, cheese, salsa)', '1 burrito', 1000, 58, 123, 30, 'Fast Food'],
  ['Subway 6" turkey sub', '1 sub', 280, 18, 46, 4, 'Fast Food'],
  ['Taco Bell Crunchy Taco', '1 taco', 170, 8, 13, 9, 'Fast Food'],
  ['Taco Bell Chicken Quesadilla', '1 quesadilla', 510, 27, 37, 26, 'Fast Food'],
  ['Panda Express Orange Chicken', '1 entree', 490, 25, 51, 23, 'Fast Food'],
  ['Panda Express Fried Rice', '1 side', 520, 11, 85, 16, 'Fast Food'],
  ['Panda Express Chow Mein', '1 side', 510, 13, 80, 20, 'Fast Food'],

  // ---- Snacks & sweets ----
  ['Potato chips', '1 oz', 150, 2, 15, 10, 'Snacks'],
  ['Tortilla chips, nacho', '1 oz', 150, 2, 18, 8, 'Snacks'],
  ['Cheese crackers (goldfish)', '55 pieces', 140, 4, 20, 5, 'Snacks'],
  ['Sandwich cookies', '3 cookies', 160, 1, 25, 7, 'Snacks'],
  ['Chocolate bar', '1.55 oz bar', 210, 3, 26, 13, 'Snacks'],
  ['Toaster pastries', '2 pastries', 370, 4, 70, 9, 'Snacks'],
  ['Rice crispy treat', '1 bar', 90, 1, 17, 2, 'Snacks'],

  // ---- Drinks ----
  ['Sports drink', '20 oz', 140, 0, 36, 0, 'Drinks'],
  ['Sports drink, zero sugar', '20 oz', 5, 0, 1, 0, 'Drinks'],
  ['Soda, cola', '12 oz can', 140, 0, 39, 0, 'Drinks'],
  ['Sweet tea', '16 oz', 180, 0, 45, 0, 'Drinks'],
  ['Energy drink, regular', '16 oz', 220, 0, 56, 0, 'Drinks'],
  ['Coffee, black', '1 cup', 2, 0, 0, 0, 'Drinks'],
];

export const FOOD_CATEGORIES = [
  'Protein', 'Shakes & Bars', 'Dairy', 'Carbs', 'Fruit', 'Veggies',
  'Fats & Sauces', 'Meals', 'Fast Food', 'Snacks', 'Drinks',
];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const FOODS = RAW.map(([name, serving, cal, p, c, f, cat]) => ({
  id: 'b:' + slug(name + '-' + serving),
  name, serving, cal, p, c, f, cat,
}));

// Fast lookup helpers
export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

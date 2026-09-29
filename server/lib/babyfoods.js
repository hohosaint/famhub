// Common first foods for babies, with TYPICAL nutrition per 100 g as served (cooked, mashed or puréed,
// no salt or sugar added). Values are rounded averages from public food composition tables and vary
// with the recipe; families can edit any food or add their own. Famhub gives no feeding advice.

const FOODS = [
  // [id, name, group, kcal, protein, fat, carbs]
  ['rice-porridge', 'Rice porridge (plain congee)', 'Grains', 46, 0.9, 0.1, 10.2],
  ['oat-porridge', 'Oat porridge (made with water)', 'Grains', 71, 2.5, 1.5, 12.0],
  ['brown-rice-porridge', 'Brown rice porridge', 'Grains', 50, 1.1, 0.4, 10.5],
  ['pasta', 'Pasta, soft cooked', 'Grains', 131, 5.0, 1.1, 25.0],
  ['pumpkin', 'Pumpkin, steamed and mashed', 'Vegetables', 20, 0.7, 0.1, 4.9],
  ['sweet-potato', 'Sweet potato, baked and mashed', 'Vegetables', 90, 2.0, 0.2, 20.7],
  ['carrot', 'Carrot, boiled and mashed', 'Vegetables', 35, 0.8, 0.2, 8.2],
  ['broccoli', 'Broccoli, steamed', 'Vegetables', 35, 2.4, 0.4, 7.2],
  ['spinach', 'Spinach, boiled', 'Vegetables', 23, 3.0, 0.3, 3.8],
  ['potato', 'Potato, boiled and mashed', 'Vegetables', 87, 1.9, 0.1, 20.1],
  ['banana', 'Banana, mashed', 'Fruit', 89, 1.1, 0.3, 22.8],
  ['apple', 'Apple purée (no sugar)', 'Fruit', 42, 0.2, 0.1, 11.3],
  ['pear', 'Pear purée', 'Fruit', 57, 0.4, 0.1, 15.2],
  ['avocado', 'Avocado, mashed', 'Fruit', 160, 2.0, 14.7, 8.5],
  ['papaya', 'Papaya, mashed', 'Fruit', 43, 0.5, 0.3, 10.8],
  ['chicken', 'Chicken breast, cooked and minced', 'Protein', 165, 31.0, 3.6, 0],
  ['fish', 'White fish (cod or batang), steamed', 'Protein', 105, 23.0, 0.9, 0],
  ['salmon', 'Salmon, steamed', 'Protein', 206, 22.0, 12.0, 0],
  ['egg', 'Egg, hard-boiled', 'Protein', 155, 12.6, 10.6, 1.1],
  ['egg-yolk', 'Egg yolk, cooked', 'Protein', 322, 16.0, 27.0, 3.6],
  ['tofu', 'Tofu, silken', 'Protein', 55, 4.8, 2.7, 2.9],
  ['lentils', 'Lentils, cooked', 'Protein', 116, 9.0, 0.4, 20.1],
  ['yogurt', 'Plain full-fat yogurt', 'Dairy', 61, 3.5, 3.3, 4.7],
  ['cheese', 'Cheddar cheese, grated', 'Dairy', 403, 25.0, 33.0, 1.3],
].map(([id, name, group, kcal, protein, fat, carbs]) => ({ id: `food:${id}`, kind: 'food', unit: 'g', name, group, per100: { kcal, protein, fat, carbs }, typical: true, preset: true }));

module.exports = { FOODS };

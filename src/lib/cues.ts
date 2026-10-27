// Form cues shown on the workout screen and read aloud by voice mode. Every exercise in the program needs 2–3.
export const CUES: Record<string, string[]> = {
    "Incline DB press (30°)": [
      "Set the bench near 30 degrees.",
      "Wrists stay stacked over the elbows.",
      "Press up and slightly in.",
    ],
    "Cable lateral raise (low pulley)": [
      "Lead with the elbow, not the hand.",
      "Stop around shoulder height.",
      "Keep the shoulder down, away from the ear.",
    ],
    "Cable lateral raise": [
      "Lead with the elbow, not the hand.",
      "Stop around shoulder height.",
      "Keep the shoulder down, away from the ear.",
    ],
    "Seated cable chest press": [
      "Pin the shoulder blades to the pad.",
      "Press until the elbows are almost straight.",
      "Keep the handles at chest height.",
    ],
    "Front plank": [
      "Ribs down, glutes tight.",
      "Push the floor away so the upper back stays broad.",
      "Straight line from head to heels.",
    ],
    "Face pull (rope, high)": [
      "Pull the rope toward your face.",
      "Finish with thumbs back and shoulder blades together.",
      "Ribs down so the low back doesn't arch.",
    ],
    "Dead bug": [
      "Low back stays lightly pressed down.",
      "Exhale as the arm and opposite leg reach.",
      "Slow enough that the pelvis doesn't rock.",
    ],
    "Cable fly, high-to-low": [
      "Keep a soft bend in the elbows.",
      "Sweep down and in, like hugging a barrel.",
      "Squeeze the chest. Don't crash the handles.",
    ],
    "Overhead rope triceps extension": [
      "Elbows point forward and stay narrow.",
      "Only the forearms move.",
      "Stretch at the bottom, lock out at the top.",
    ],
    "Triceps pushdown": [
      "Elbows pinned to your sides.",
      "Straighten the arms fully.",
      "Control the way up.",
    ],
    "Lat pulldown (high pulley)": [
      "Lean back just a little.",
      "Pull the bar to the upper chest.",
      "Drive the elbows toward your hips.",
    ],
    "Chest-supported DB row": [
      "Chest stays on the pad.",
      "Pull the elbows back, not out wide.",
      "Pause when the shoulder blades squeeze.",
    ],
    "Kneeling cable crunch": [
      "Hips stay stacked over the knees.",
      "Round the spine. Don't just hinge at the hips.",
      "Exhale hard at the bottom.",
    ],
    "Standing DB calf raise": [
      "Pause at the top on the balls of the feet.",
      "Lower until you feel a calf stretch.",
      "Knees stay soft, not locked.",
    ],
    "Seated cable row (V-handle)": [
      "Sit tall. Don't swing the torso.",
      "Pull the handle to the lower ribs.",
      "Shoulder blades back and down.",
    ],
    "Incline DB curl": [
      "Upper arms stay pointing at the floor.",
      "Curl without the shoulders rolling forward.",
      "Lower until the biceps stretch.",
    ],
    "Hammer curl": [
      "Thumbs stay up.",
      "Elbows stay beside the ribs.",
      "Don't rock the hips to start the weight.",
    ],
    "Hollow hold": [
      "Low back pressed flat.",
      "Ribs down, arms and legs long.",
      "If the back peels up, bend the knees.",
    ],
    "Side plank": [
      "Bottom elbow under the shoulder.",
      "Hips stacked. Don't let the top hip roll back.",
      "Push the floor away.",
    ],
    "DB Romanian deadlift": [
      "Soft knees, hinge at the hips.",
      "Dumbbells stay close to the legs.",
      "Stop when the hamstrings pull, then stand tall.",
    ],
    "Pallof press (cable, mid)": [
      "Stand side-on, feet about hip width.",
      "Press straight out and don't let the cable twist you.",
      "Ribs stacked over the pelvis.",
    ],
    "Pallof press": [
      "Stand side-on, feet about hip width.",
      "Press straight out and don't let the cable twist you.",
      "Ribs stacked over the pelvis.",
    ],
    "Leg extension (3 s down, pain-free)": [
      "Pad sits just above the ankles.",
      "Three seconds down, only a pain-free range.",
      "Don't slam the knees straight.",
    ],
    "Leg extension": [
      "Pad sits just above the ankles.",
      "Squeeze the quads at the top.",
      "Don't slam the knees straight.",
    ],
    "Seated leg curl": [
      "Pad on the lower calves.",
      "Curl the heels toward the glutes.",
      "Hips stay on the seat.",
    ],
    "Hip thrust (DB or barbell)": [
      "Upper back on the bench, chin tucked.",
      "Drive through the heels.",
      "Squeeze the glutes at the top, ribs down.",
    ],
    "Reverse crunch on bench": [
      "Lift the hips, not just the knees.",
      "Low back stays down.",
      "Lower with control.",
    ],
    "Reverse crunch": [
      "Lift the hips, not just the knees.",
      "Low back stays down.",
      "Lower with control.",
    ],
    "Flat DB press": [
      "Feet planted.",
      "Lower until the dumbbells are beside the chest.",
      "Elbows about 45 degrees from your sides.",
    ],
    "Single-arm cable row (mid)": [
      "Brace so the cable doesn't twist you.",
      "Pull the elbow past the ribs.",
      "Reach long on the way back.",
    ],
    "Seated DB shoulder press": [
      "Start with the dumbbells at ear height.",
      "Press up without shrugging.",
      "Don't bang the weights together.",
    ],
    "Neutral-grip lat pulldown": [
      "Palms face each other.",
      "Pull the elbows down toward the pockets.",
      "Chest stays up.",
    ],
    "Reverse cable fly (high)": [
      "Soft elbows, arms almost straight.",
      "Sweep wide until the hands line up with the shoulders.",
      "Squeeze the rear delts. Don't shrug.",
    ],
    "Cable curl": [
      "Elbows pinned in front of the hips.",
      "Curl the bar. Don't lean back.",
      "Lower until the elbows are straight.",
    ],
    "Rope pushdown": [
      "Split the rope at the bottom.",
      "Elbows glued to your sides.",
      "Lock out, then come back under control.",
    ],
    "Cable woodchop (high to low)": [
      "Pivot the back foot.",
      "Arms stay long. Rotate from the trunk.",
      "Finish with the hands near the opposite hip.",
    ],
    "DB curl": [
      "Elbows stay under the shoulders.",
      "Palms up. No hip swing.",
      "Lower until the elbows are straight.",
    ],
    "DB skull crusher": [
      "Upper arms stay vertical.",
      "Lower the dumbbells beside the head, not onto it.",
      "Elbows point at the ceiling.",
    ],
    "Bodyweight box squats, empty bar x10, light sets": [
      "Sit back to the box. Don't drop.",
      "Knees track over the mid-foot.",
      "Stand by pushing the floor away.",
    ],
    "Barbell box squat (box at or above parallel)": [
      "Box at or above parallel.",
      "Brace before you unrack.",
      "Touch the box lightly, then stand.",
    ],
    "Band lying leg curl": [
      "Hips stay down.",
      "Curl the heels toward the glutes.",
      "Control the band on the way back.",
    ],
    "Cable pull-through (rope)": [
      "Face away, rope between the legs.",
      "Hinge, then squeeze the glutes to stand.",
      "Arms stay straight. This is a hip move.",
    ],
    "Seated calf raise (DB on knees)": [
      "Dumbbells rest on the knees.",
      "Full stretch at the bottom.",
      "Pause at the top.",
    ],
    "Incline walk, 10–14° at 2.8–3.3 mph": [
      "Hold the rails lightly. Don't hang.",
      "Short stride, land mid-foot.",
      "Stay tall. Don't lean on the console.",
    ],
    "Arm circles": [
      "Start with small circles, then let them grow.",
      "Shoulders stay down.",
      "Keep breathing.",
    ],
    "Wall slides": [
      "Back of the hands and elbows try to touch the wall.",
      "Slide up only as far as the ribs stay down.",
      "Don't shrug.",
    ],
    "Scapular squeezes": [
      "Pinch the shoulder blades down and back.",
      "Don't shrug toward the ears.",
      "Hold one second, then release.",
    ],
    "Incline walk primer, easy pace": [
      "Easy pace. This is only to get warm.",
      "Hold the rails lightly.",
      "Stay tall.",
    ],
    "Leg swings, front to back": [
      "Hold a rack for balance.",
      "Swing under control. Don't yank the hip.",
      "Stay tall on the standing leg.",
    ],
    "Bodyweight squat primer": [
      "Sit the hips back and down.",
      "Knees track over the mid-foot.",
      "Easy reps. Stop above any knee pinch.",
    ],
    "Glute bridges, easy": [
      "Drive through the heels.",
      "Squeeze the glutes at the top.",
      "Ribs stay down.",
    ],
    "Easy march in place": [
      "Lift the knees only as high as is easy.",
      "Arms swing naturally.",
      "Quiet feet.",
    ],
    "Doorway pec stretch": [
      "Forearm on the frame, elbow near shoulder height.",
      "Step through until the chest opens.",
      "Breathe. Don't bounce.",
    ],
    "Triceps stretch behind the head": [
      "Elbow points at the ceiling.",
      "Gentle pull. Stop before the shoulder pinches.",
      "Ribs stay down.",
    ],
    "Lat stretch, arm overhead": [
      "Reach long, then lean slightly away.",
      "Stop at a stretch along the side of the back.",
      "Don't shrug the shoulder to the ear.",
    ],
    "Biceps stretch, arm on a wall": [
      "Arm straight, palm on the wall.",
      "Turn the body away until the biceps pull.",
      "Keep the elbow soft if the front of the shoulder bites.",
    ],
    "Hamstring stretch, one leg long": [
      "Hinge from the hips, back long.",
      "Stop at a strong pull, not a stab.",
      "Don't bounce.",
    ],
    "Hip flexor stretch, half kneel": [
      "Back knee down, pelvis tucked.",
      "Squeeze the glute of the kneeling leg.",
      "Tall chest. Don't arch the low back.",
    ],
    "Calf stretch on a step": [
      "Heel drops, knee straight.",
      "Then soften the knee for a second stretch.",
      "Hold. Don't bounce.",
    ],
    "Chest opener, hands clasped behind": [
      "Clasp the hands behind you or hold a rack.",
      "Lift the chest and squeeze the shoulder blades.",
      "Stop if the front of the shoulder pinches.",
    ],
    "Joint circles, easy range": [
      "Move one joint at a time through an easy range.",
      "Ankles, hips, then shoulders.",
      "Nothing should sting. Shrink the circle if it does.",
    ],
};

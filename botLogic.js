const { supabase } = require('./supabaseClient');

// In-memory session store: { phoneNumber: { step, name, topic } }
const sessions = {};

const STEP_ORDER = [
  'Greeting',
  'Name',
  'Main Menu - Find',
  'Main Menu - Update',
  'Main Menu - View Matches',
  'Interest Tech',
  'Interest Business',
  'Interest Creative',
  'Interest Fitness',
  'Interest Others',
  'Topic Input',
  'Experience Beginner',
  'Experience Intermediate',
  'Experience Advanced',
  'Show Matches',
  'Connect Person',
  'Exit',
];

async function getResponse(userText, from) {
  try {
    const query = userText.toLowerCase().trim();

    // Initialize session
    if (!sessions[from]) {
      sessions[from] = { step: 'Greeting', name: null, topic: null };
    }

    const session = sessions[from];

    // Fetch all rows from bot_responses
    const { data, error } = await supabase
      .from('bot_responses')
      .select('step, keywords, response');

    if (error) {
      console.error('Supabase error:', error);
      return "I'm having trouble accessing my brain right now. Please try again later.";
    }

    // Find a matching row: current step's wildcard OR keyword match
    let matched = null;

    // First, try to match based on current step's keywords
    const currentStepRow = data.find(row => row.step === session.step);

    if (currentStepRow) {
      const keys = currentStepRow.keywords || [];
      if (keys.includes('*') || keys.some(k => query.includes(k))) {
        matched = currentStepRow;
      }
    }

    // If no match on current step, try any row's keywords (for menu jumps)
    if (!matched) {
      matched = data.find(row => {
        const keys = row.keywords || [];
        return !keys.includes('*') && keys.some(k => query.includes(k));
      });
    }

    // If still no match, use the current step as a fallback (for wildcard steps)
    if (!matched && currentStepRow && (currentStepRow.keywords || []).includes('*')) {
      matched = currentStepRow;
    }

    if (!matched) {
      return "I'm not sure about that. Could you please rephrase? 😊";
    }

    // Update session state
    if (matched.step === 'Name') {
      // Capture name from the user's message
      session.name = userText.trim();
    }

    if (['Interest Tech','Interest Business','Interest Creative','Interest Fitness','Interest Others'].includes(matched.step)) {
      session.topic = matched.step.replace('Interest ', '');
    }

    // Advance step
    const nextStepIndex = STEP_ORDER.indexOf(matched.step) + 1;
    if (nextStepIndex < STEP_ORDER.length) {
      session.step = STEP_ORDER[nextStepIndex];
    }

    // Reset session on Exit
    if (matched.step === 'Exit') {
      delete sessions[from];
    }

    // Replace placeholders
    let response = matched.response;
    response = response.replace(/{name}/g, session.name || 'there');
    response = response.replace(/{topic}/g, session.topic || 'your chosen');

    return response;

  } catch (err) {
    console.error('Error in botLogic:', err);
    return "Something went wrong. Please try again later.";
  }
}

module.exports = { getResponse };

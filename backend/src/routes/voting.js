const express = require('express');
const router = express.Router();
const { recordVote, getVoteCounts, getUserVotes, getAllBoats, getAllPrideBoats } = require('../models/database');
const logger = require('../services/logger');

/**
 * Get all boats with vote counts for the 2025 voting app
 */
router.get('/boats', async (req, res) => {
  try {
    const voteCounts = await getVoteCounts();
    const prideBoats = await getAllPrideBoats();

    // Create a map of pride boats by parade_position for easy lookup
    const prideBoatMap = new Map();
    prideBoats.forEach(boat => {
      prideBoatMap.set(boat.parade_position, boat);
    });

    // Transform data for the frontend with enhanced pride boat information
    const boats = voteCounts.map((boat, index) => {
      const prideBoat = prideBoatMap.get(boat.boat_number);

      return {
        id: boat.boat_number,
        name: boat.name,
        theme: boat.theme || prideBoat?.theme || boat.organisation,
        position: index + 1,
        hearts: parseInt(boat.hearts) || 0,
        stars: parseInt(boat.stars) || 0,
        organisation: boat.organisation || prideBoat?.organisation,
        description: prideBoat?.description || '',
        captain_name: prideBoat?.captain_name || null,
        boat_type: prideBoat?.boat_type || null,
        status: prideBoat?.status || 'active',
        pride_boat_id: prideBoat?.id || null
      };
    });

    res.json({
      success: true,
      data: boats,
      count: boats.length
    });
  } catch (error) {
    logger.error('Error fetching boats with vote counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch boats'
    });
  }
});

/**
 * Cast a vote (heart or star)
 */
router.post('/vote', async (req, res) => {
  try {
    const { boat_number, vote_type, user_session } = req.body;

    if (!boat_number || !vote_type || !user_session) {
      return res.status(400).json({
        success: false,
        error: 'boat_number, vote_type, and user_session are required'
      });
    }

    if (!['heart', 'star'].includes(vote_type)) {
      return res.status(400).json({
        success: false,
        error: 'vote_type must be either "heart" or "star"'
      });
    }

    // Check if user has reached star limit for this boat (max 5 stars per boat)
    if (vote_type === 'star') {
      const userVotes = await getUserVotes(user_session);
      const boatStars = userVotes.find(v => v.boat_number === boat_number && v.vote_type === 'star');
      
      if (boatStars && boatStars.count >= 5) {
        return res.status(429).json({
          success: false,
          error: 'Maximum 5 stars per boat reached',
          current_stars: boatStars.count
        });
      }
    }

    // Record the vote
    const vote = await recordVote({
      boat_number,
      vote_type,
      user_session,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    logger.info(`Vote recorded: ${vote_type} for boat ${boat_number}`, {
      user_session,
      vote_id: vote.id
    });

    res.status(201).json({
      success: true,
      data: vote,
      message: `${vote_type} recorded for boat ${boat_number}`
    });

  } catch (error) {
    logger.error('Error recording vote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record vote'
    });
  }
});

/**
 * Get user's voting history
 */
router.get('/user/:user_session', async (req, res) => {
  try {
    const { user_session } = req.params;
    const userVotes = await getUserVotes(user_session);

    // Transform data for frontend
    const voteSummary = {
      total_votes: 0,
      boats_voted: 0,
      hearts_given: 0,
      stars_given: 0,
      votes_by_boat: {}
    };

    userVotes.forEach(vote => {
      const count = parseInt(vote.count) || 0;
      voteSummary.total_votes += count;
      
      if (vote.vote_type === 'heart') {
        voteSummary.hearts_given += count;
      } else if (vote.vote_type === 'star') {
        voteSummary.stars_given += count;
      }

      if (!voteSummary.votes_by_boat[vote.boat_number]) {
        voteSummary.votes_by_boat[vote.boat_number] = { hearts: 0, stars: 0 };
      }
      
      voteSummary.votes_by_boat[vote.boat_number][vote.vote_type + 's'] = count;
    });

    voteSummary.boats_voted = Object.keys(voteSummary.votes_by_boat).length;

    res.json({
      success: true,
      data: voteSummary,
      user_session
    });

  } catch (error) {
    logger.error('Error fetching user votes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user votes'
    });
  }
});

/**
 * Get leaderboard (top boats by stars)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const voteCounts = await getVoteCounts();
    const prideBoats = await getAllPrideBoats();

    // Create a map of pride boats by parade_position for easy lookup
    const prideBoatMap = new Map();
    prideBoats.forEach(boat => {
      prideBoatMap.set(boat.parade_position, boat);
    });

    // Sort by stars descending, then by hearts descending
    const leaderboard = voteCounts
      .sort((a, b) => {
        const starDiff = parseInt(b.stars) - parseInt(a.stars);
        if (starDiff !== 0) return starDiff;
        return parseInt(b.hearts) - parseInt(a.hearts);
      })
      .slice(0, limit)
      .map((boat, index) => {
        const prideBoat = prideBoatMap.get(boat.boat_number);

        return {
          rank: index + 1,
          boat_number: boat.boat_number,
          name: boat.name,
          organisation: boat.organisation || prideBoat?.organisation,
          theme: boat.theme || prideBoat?.theme,
          description: prideBoat?.description || '',
          captain_name: prideBoat?.captain_name || null,
          boat_type: prideBoat?.boat_type || null,
          stars: parseInt(boat.stars) || 0,
          hearts: parseInt(boat.hearts) || 0,
          total_votes: parseInt(boat.total_votes) || 0,
          pride_boat_id: prideBoat?.id || null
        };
      });

    res.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

/**
 * Get voting statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const voteCounts = await getVoteCounts();
    
    const stats = {
      total_boats: voteCounts.length,
      total_hearts: voteCounts.reduce((sum, boat) => sum + (parseInt(boat.hearts) || 0), 0),
      total_stars: voteCounts.reduce((sum, boat) => sum + (parseInt(boat.stars) || 0), 0),
      total_votes: voteCounts.reduce((sum, boat) => sum + (parseInt(boat.total_votes) || 0), 0),
      top_boat_by_stars: null,
      top_boat_by_hearts: null,
      generated_at: new Date().toISOString()
    };

    if (voteCounts.length > 0) {
      // Find top boats
      const sortedByStars = [...voteCounts].sort((a, b) => parseInt(b.stars) - parseInt(a.stars));
      const sortedByHearts = [...voteCounts].sort((a, b) => parseInt(b.hearts) - parseInt(a.hearts));
      
      stats.top_boat_by_stars = {
        boat_number: sortedByStars[0].boat_number,
        name: sortedByStars[0].name,
        stars: parseInt(sortedByStars[0].stars) || 0
      };
      
      stats.top_boat_by_hearts = {
        boat_number: sortedByHearts[0].boat_number,
        name: sortedByHearts[0].name,
        hearts: parseInt(sortedByHearts[0].hearts) || 0
      };
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching voting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch voting statistics'
    });
  }
});

/**
 * Submit idea for WorldPride 2026
 */
router.post('/ideas', async (req, res) => {
  try {
    const { idea, email, user_session } = req.body;

    if (!idea || !user_session) {
      return res.status(400).json({
        success: false,
        error: 'idea and user_session are required'
      });
    }

    // For now, just log the idea (in production, save to database)
    logger.info('WorldPride 2026 idea submitted:', {
      idea: idea.substring(0, 100) + (idea.length > 100 ? '...' : ''),
      email: email || 'anonymous',
      user_session,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your idea! We will consider it for WorldPride 2026.',
      submitted_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error submitting idea:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit idea'
    });
  }
});

module.exports = router;

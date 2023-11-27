import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';

const Favorites = () => {
  const favoriteItems = [
    {
      type: 'TV-Show',
      title: 'the bear',
      description: 'tv show centered around family and culinary excellence',
      image: 'bear.png',
      link: 'https://www.amazon.ca/Nonviolent-Communication-Language-Life-Changing-Relationships-ebook/dp/B014OISVU4'
    },
    {
      type: 'YouTube Channel',
      title: 'tetragrammaton',
      description: 'In-depth interviews that may blow your mind',
      image: 'tetra.jpg',
      link: 'https://www.youtube.com/@tetragrammaton_now'
    },
    {
        type: 'Spotify Playlist',
        title: 'a-lista',
        description: 'Spotify playlist with my favorite songs atm',
        image: 'spotify.jpg',
        link: 'https://open.spotify.com/playlist/3ms6xpuwuMK5wAEopKB9Xo?si=6505ad2ddeb44dd5'
      },
      {
        type: 'Book',
        title: 'non violent communication',
        description: 'Learn how to first create empathy in the conversation',
        image: 'nonv.jpg',
        link: 'https://www.amazon.ca/Nonviolent-Communication-Language-Life-Changing-Relationships/dp/189200528X'
      },
  ];

  return (
    <Container id="favorites" className="my-5">
      <h3>current favorites</h3>
      <Row>
        {favoriteItems.map((item, index) => (
          <Col xs={6} md={6} lg={3} className="mb-4" key={index}> {/* Changed lg={4} to lg={3} */}
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-decoration-none text-reset">
              <Card className="h-100 favorite-card"> {/* Added h-100 to make cards of equal height */}
                <Card.Img variant="top" src={item.image} className="favorite-image" />
                <Card.Body className="favorite-card-body">
                  <Card.Title>{item.title}</Card.Title>
                  <Card.Text>{item.description}</Card.Text>
                </Card.Body>
              </Card>
            </a>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default Favorites;

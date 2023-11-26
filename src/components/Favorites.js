import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { BiRightArrowAlt  } from 'react-icons/bi'; // Importing specific icon

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
      description: 'in-depth interviews that may blow your mind',
      image: 'tetra.jpg',
      link: 'https://www.youtube.com/@tetragrammaton_now'
    },
    {
        type: 'Spotify Playlist',
        title: 'a-lista',
        description: 'spotify playlist with my favorite songs atm',
        image: 'spotify.jpg',
        link: 'https://open.spotify.com/playlist/3ms6xpuwuMK5wAEopKB9Xo?si=6505ad2ddeb44dd5'
      },
  ];

  return (
    <Container id="favorites" className="my-5">
      <h3>things I'm into right now</h3>
      <Row>
        {favoriteItems.map((item, index) => (
            <Col xs={12} md={6} lg={4} className="mb-4" key={index}>
                <Card>
                <Card.Img variant="top" src={item.image} className="favorite-image" />
                <Card.Body className="favorite-card-body">
                    <Card.Title>{item.title}</Card.Title>
                    <Card.Text>{item.description}</Card.Text>
                    <Button variant="link" className="custom-button no-padding-left" href={item.link} target="_blank">
                        <BiRightArrowAlt /> check it out
                    </Button>                
                </Card.Body>
                </Card>
            </Col>
            ))}
      </Row>
    </Container>
  );
};

export default Favorites;

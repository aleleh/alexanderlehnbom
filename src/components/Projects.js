import React from 'react';
import { Container, Card, Button, Row, Col } from 'react-bootstrap';
import { BiRightArrowAlt  } from 'react-icons/bi'; // Importing specific icon


const Projects = () => {
  return (
    <Container className="my-5">
      <h3 id='projects'>projects</h3>
      <Row>
        {/* Example project card */}
        <Col md={4} sm={12} className="mb-3">
          <Card>
            <Card.Img variant="top" src="path-to-your-project-image.jpg" />
            <Card.Body>
              <Card.Title>React site for investing company</Card.Title>
              <Card.Text>
                Some quick example text to build on the card title and make up the bulk of the card's content.
              </Card.Text>
              <Button variant="link" className="custom-button no-padding-left" href='https://deepstone-1eefc.web.app/' target="_blank"><BiRightArrowAlt /> check it out</Button>              
            </Card.Body>
          </Card>
        </Col>
        {/* Repeat for other projects */}
        {/* Example project card */}
        <Col md={4} sm={12} className="mb-3">
          <Card>
            <Card.Img variant="top" src="path-to-your-project-image.jpg" />
            <Card.Body>
              <Card.Title>E-commerce store</Card.Title>
              <Card.Text>
                Some quick example text to build on the card title and make up the bulk of the card's content.
              </Card.Text>
              <Button variant="link" className="custom-button no-padding-left" href='https://deepstone-1eefc.web.app/' target="_blank"><BiRightArrowAlt /> check it out</Button>              
            </Card.Body>
          </Card>
        </Col>
        {/* Repeat for other projects */}
        <Col md={4} sm={12} className="mb-3">
          <Card>
            <Card.Img variant="top" src="path-to-your-project-image.jpg" />
            <Card.Body>
              <Card.Title>React site for investing company</Card.Title>
              <Card.Text>
                Some quick example text to build on the card title and make up the bulk of the card's content.
              </Card.Text>
              <Button variant="link" className="custom-button no-padding-left" href='https://deepstone-1eefc.web.app/' target="_blank"><BiRightArrowAlt /> check it out</Button>              
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Projects;
